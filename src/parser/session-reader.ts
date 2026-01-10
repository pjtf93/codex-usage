import { readFileSync } from 'node:fs';
import { globSync } from 'tinyglobby';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import {
  TokenUsageEvent,
  ParsedSession,
  SessionMetaPayload,
  TurnContextPayload,
  TokenCountPayload,
  RawUsage
} from './types.js';
import { z } from 'zod';

const DEFAULT_CODEX_DIR = join(homedir(), '.codex');
const SESSION_GLOB = '**/*.jsonl';

const recordSchema = z.record(z.string(), z.unknown());

function ensureNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeRawUsage(value: unknown): RawUsage | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const input = ensureNumber(record.input_tokens);
  const cached = ensureNumber(record.cached_input_tokens ?? record.cache_read_input_tokens ?? 0);
  const output = ensureNumber(record.output_tokens);
  const reasoning = ensureNumber(record.reasoning_output_tokens ?? 0);
  const total = ensureNumber(record.total_tokens ?? 0);

  return {
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: total > 0 ? total : input + output,
  };
}

function subtractRawUsage(current: RawUsage, previous: RawUsage | null): RawUsage {
  return {
    input_tokens: Math.max(current.input_tokens - (previous?.input_tokens ?? 0), 0),
    cached_input_tokens: Math.max(
      (current.cached_input_tokens ?? 0) - (previous?.cached_input_tokens ?? 0),
      0
    ),
    output_tokens: Math.max(current.output_tokens - (previous?.output_tokens ?? 0), 0),
    reasoning_output_tokens: Math.max(
      (current.reasoning_output_tokens ?? 0) - (previous?.reasoning_output_tokens ?? 0),
      0
    ),
    total_tokens: Math.max((current.total_tokens ?? 0) - (previous?.total_tokens ?? 0), 0),
  };
}

function convertToDelta(raw: RawUsage): Omit<TokenUsageEvent, 'timestamp' | 'model' | 'sessionId'> {
  const total = (raw.total_tokens ?? 0) > 0 ? raw.total_tokens! : raw.input_tokens + raw.output_tokens;
  const cached = Math.min(raw.cached_input_tokens ?? 0, raw.input_tokens);

  return {
    inputTokens: raw.input_tokens,
    cachedInputTokens: cached,
    outputTokens: raw.output_tokens,
    reasoningOutputTokens: raw.reasoning_output_tokens ?? 0,
    totalTokens: total,
  };
}

interface JsonLine {
  timestamp?: string;
  type?: string;
  payload?: unknown;
}

export class SessionReader {
  private codexDir: string;

  constructor(codexDir?: string) {
    this.codexDir = codexDir || DEFAULT_CODEX_DIR;
  }

  readAllSessions(): ParsedSession[] {
    const sessions: ParsedSession[] = [];
    const sessionFiles = this.findSessionFiles();

    for (const file of sessionFiles) {
      const session = this.readSessionFile(file);
      if (session && session.events.length > 0) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  private findSessionFiles(): string[] {
    const globPattern = join(this.codexDir, 'sessions', SESSION_GLOB);
    return globSync([globPattern], { absolute: true });
  }

  private readSessionFile(filePath: string): ParsedSession | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

      let sessionId = '';
      let cwd = '';
      let gitBranch: string | undefined;
      let gitRepo: string | undefined;
      let currentModel: string | undefined;
      let previousTotals: RawUsage | null = null;
      const events: TokenUsageEvent[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as JsonLine;

          // Extract session metadata
          if (parsed.type === 'session_meta' && parsed.payload) {
            const metaResult = z.object({
              id: z.string(),
              cwd: z.string(),
              git: z.object({
                branch: z.string().optional(),
                repository_url: z.string().optional(),
              }).optional(),
            }).safeParse(parsed.payload);

            if (metaResult.success) {
              sessionId = metaResult.data.id;
              cwd = metaResult.data.cwd;
              gitBranch = metaResult.data.git?.branch;
              gitRepo = metaResult.data.git?.repository_url;
            }
            continue;
          }

          // Extract model from turn_context
          if (parsed.type === 'turn_context' && parsed.payload) {
            const contextResult = z.object({
              cwd: z.string(),
              model: z.string().optional(),
            }).safeParse(parsed.payload);

            if (contextResult.success) {
              cwd = contextResult.data.cwd; // Update cwd if provided
              if (contextResult.data.model) {
                currentModel = contextResult.data.model;
              }
            }
            continue;
          }

          // Extract token usage from event_msg
          if (parsed.type === 'event_msg' && parsed.payload && parsed.timestamp) {
            const tokenPayloadResult = z.object({
              type: z.literal('token_count'),
              info: z.object({
                total_token_usage: z.record(z.string(), z.unknown()).optional(),
                last_token_usage: z.record(z.string(), z.unknown()).optional(),
              }).optional(),
            }).safeParse(parsed.payload);

            if (!tokenPayloadResult.success) {
              continue;
            }

            const info = tokenPayloadResult.data.info;
            if (!info) continue;

            const lastUsage = info.last_token_usage ? normalizeRawUsage(info.last_token_usage) : null;
            const totalUsage = info.total_token_usage ? normalizeRawUsage(info.total_token_usage) : null;

            let raw = lastUsage;
            if (raw == null && totalUsage != null) {
              raw = subtractRawUsage(totalUsage, previousTotals);
            }

            if (totalUsage != null) {
              previousTotals = totalUsage;
            }

            if (raw == null) {
              continue;
            }

            const delta = convertToDelta(raw);

            if (
              delta.inputTokens === 0 &&
              delta.cachedInputTokens === 0 &&
              delta.outputTokens === 0 &&
              delta.reasoningOutputTokens === 0
            ) {
              continue;
            }

            const event: TokenUsageEvent = {
              timestamp: new Date(parsed.timestamp),
              model: currentModel || 'unknown',
              sessionId: sessionId || 'unknown',
              ...delta,
            };

            events.push(event);
          }
        } catch {
          // Skip malformed lines
          continue;
        }
      }

      if (events.length === 0) {
        return null;
      }

      return {
        sessionId: sessionId || 'unknown',
        cwd: cwd || 'unknown',
        gitBranch,
        gitRepo,
        events,
      };
    } catch {
      console.error(`Failed to read session file: ${filePath}`);
      return null;
    }
  }
}

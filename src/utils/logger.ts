import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

type LogLevel = 'info' | 'success' | 'error';

const LOG_DIR = join(homedir(), '.codex-usage');
const LOG_FILE = join(LOG_DIR, 'logs.jsonl');

function writeLog(level: LogLevel, message: string, data: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch {
    return;
  }
}

export function logInfo(message: string, data: Record<string, unknown> = {}): void {
  writeLog('info', message, data);
}

export function logSuccess(message: string, data: Record<string, unknown> = {}): void {
  writeLog('success', message, data);
}

export function logError(message: string, data: Record<string, unknown> = {}): void {
  writeLog('error', message, data);
}

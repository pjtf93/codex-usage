import { TokenUsageEvent, ParsedSession } from '../parser/types.js';

export interface DirectoryUsage {
  path: string;
  displayPath: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  costUSD: number;
  sessionCount: number;
  eventCount: number;
  models: Map<string, number>;
}

export interface DateUsage {
  date: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  costUSD: number;
  sessionCount: number;
  eventCount: number;
  models: Map<string, number>;
}

export interface ModelUsage {
  model: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  costUSD: number;
  sessionCount: number;
  eventCount: number;
}

export interface AggregatedData {
  directories: DirectoryUsage[];
  dates: DateUsage[];
  models: ModelUsage[];
  totalTokens: number;
  totalCost: number;
  totalSessions: number;
  dateRange: { start: Date; end: Date };
}

export type SortField = 'tokens' | 'cost' | 'date';
export type SortDirection = 'asc' | 'desc';

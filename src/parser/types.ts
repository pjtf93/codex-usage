export interface TokenUsageEvent {
  timestamp: Date;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  sessionId: string;
}

export interface ParsedSession {
  sessionId: string;
  cwd: string;
  gitBranch?: string;
  gitRepo?: string;
  events: TokenUsageEvent[];
}

export interface RawUsage {
  input_tokens: number;
  cached_input_tokens?: number;
  output_tokens: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

export interface SessionMetaPayload {
  id: string;
  timestamp: string;
  cwd: string;
  originator?: string;
  cli_version?: string;
  instructions?: string | null;
  source?: string;
  model_provider?: string;
  git?: {
    commit_hash?: string;
    branch?: string;
    repository_url?: string;
  };
}

export interface TurnContextPayload {
  cwd: string;
  approval_policy?: string;
  sandbox_policy?: {
    mode?: string;
    network_access?: boolean;
    exclude_tmpdir_env_var?: boolean;
    exclude_slash_tmp?: boolean;
  };
  model?: string;
  effort?: string;
  summary?: string;
}

export interface TokenCountPayload {
  type: 'token_count';
  info?: {
    total_token_usage?: RawUsage;
    last_token_usage?: RawUsage;
    model?: string;
    metadata?: Record<string, unknown>;
  };
}

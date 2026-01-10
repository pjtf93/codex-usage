export interface ModelPricing {
  inputCostPer1K: number;
  outputCostPer1K: number;
  cacheDiscount: number;
}

export const CODEX_PRICING: Record<string, ModelPricing> = {
  // Codex models (from OpenAI pricing - Standard tier)
  'gpt-5.2-codex': {
    inputCostPer1K: 0.00175,
    outputCostPer1K: 0.014,
    cacheDiscount: 0.1, // 90% discount for cached input
  },
  'gpt-5.1-codex': {
    inputCostPer1K: 0.00125,
    outputCostPer1K: 0.010,
    cacheDiscount: 0.1, // 90% discount for cached input
  },
  'gpt-5.1-codex-max': {
    inputCostPer1K: 0.00125,
    outputCostPer1K: 0.010,
    cacheDiscount: 0.1,
  },
  'gpt-5.1-codex-mini': {
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.002,
    cacheDiscount: 0.1,
  },
  'gpt-5-codex': {
    inputCostPer1K: 0.00125,
    outputCostPer1K: 0.010,
    cacheDiscount: 0.1,
  },
  'gpt-5.0-codex': {
    inputCostPer1K: 0.00125,
    outputCostPer1K: 0.010,
    cacheDiscount: 0.1,
  },
  // Other OpenAI models
  'gpt-5.2': {
    inputCostPer1K: 0.00175,
    outputCostPer1K: 0.014,
    cacheDiscount: 0.1,
  },
  'gpt-5.1': {
    inputCostPer1K: 0.00125,
    outputCostPer1K: 0.010,
    cacheDiscount: 0.1,
  },
  'gpt-5': {
    inputCostPer1K: 0.00125,
    outputCostPer1K: 0.010,
    cacheDiscount: 0.1,
  },
  'gpt-5-mini': {
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.002,
    cacheDiscount: 0.1,
  },
  'gpt-5-nano': {
    inputCostPer1K: 0.00005,
    outputCostPer1K: 0.0004,
    cacheDiscount: 0.1,
  },
  'gpt-4o': {
    inputCostPer1K: 0.0025,
    outputCostPer1K: 0.010,
    cacheDiscount: 0.5,
  },
  'gpt-4o-mini': {
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    cacheDiscount: 0.5,
  },
  'o1': {
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.060,
    cacheDiscount: 0.5,
  },
  'o1-mini': {
    inputCostPer1K: 0.0011,
    outputCostPer1K: 0.0044,
    cacheDiscount: 0.5,
  },
  'o3': {
    inputCostPer1K: 0.002,
    outputCostPer1K: 0.008,
    cacheDiscount: 0.25,
  },
  'o3-mini': {
    inputCostPer1K: 0.0011,
    outputCostPer1K: 0.0044,
    cacheDiscount: 0.5,
  },
};

export const DEFAULT_MODEL = 'gpt-5.1-codex';

export function getPricing(model: string): ModelPricing {
  return CODEX_PRICING[model] || CODEX_PRICING[DEFAULT_MODEL];
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
  model: string
): number {
  const pricing = getPricing(model);

  // Regular input tokens
  const regularInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const inputCost = (regularInputTokens / 1000) * pricing.inputCostPer1K;

  // Cache read tokens (discounted)
  const cacheReadCost = (cachedInputTokens / 1000) * pricing.inputCostPer1K * pricing.cacheDiscount;

  // Output tokens (includes reasoning tokens)
  const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;

  return inputCost + cacheReadCost + outputCost;
}

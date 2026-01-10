import { TokenUsageEvent, ParsedSession } from '../parser/types.js';
import { DirectoryUsage, DateUsage, ModelUsage } from '../aggregator/types.js';
import { calculateCost, getPricing } from './pricing.js';

export function calculateDirectoryCosts(directories: DirectoryUsage[]): DirectoryUsage[] {
  return directories.map(dir => ({
    ...dir,
    costUSD: calculateCost(
      dir.inputTokens,
      dir.outputTokens,
      dir.cachedInputTokens,
      Array.from(dir.models.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'gpt-5.1-codex'
    ),
  }));
}

export function calculateDateCosts(dates: DateUsage[]): DateUsage[] {
  return dates.map(date => ({
    ...date,
    costUSD: calculateCost(
      date.inputTokens,
      date.outputTokens,
      date.cachedInputTokens,
      Array.from(date.models.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'gpt-5.1-codex'
    ),
  }));
}

export function calculateModelCosts(models: ModelUsage[]): ModelUsage[] {
  return models.map(model => ({
    ...model,
    costUSD: calculateCost(
      model.inputTokens,
      model.outputTokens,
      model.cachedInputTokens,
      model.model
    ),
  }));
}

export function calculateEventCost(event: TokenUsageEvent): number {
  return calculateCost(
    event.inputTokens,
    event.outputTokens,
    event.cachedInputTokens,
    event.model
  );
}

export function calculateSessionCost(session: ParsedSession): number {
  return session.events.reduce((total, event) => total + calculateEventCost(event), 0);
}

export function calculateTotalCost(events: TokenUsageEvent[]): number {
  return events.reduce((total, event) => total + calculateEventCost(event), 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

import { format, formatDistanceToNow } from 'date-fns';
import { formatCurrency, formatNumber, formatPercentage } from '../calculator/cost-calculator.js';

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDateRange(start: Date, end: Date): string {
  const startStr = format(start, 'MMM d, yyyy');
  const endStr = format(end, 'MMM d, yyyy');
  return `${startStr} - ${endStr}`;
}

export function formatDateForDisplay(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path;

  // Keep first part and last two parts
  const first = parts[0];
  const last = parts.slice(-2).join('/');

  return `${first}/.../${last}`;
}

export function getModelDisplayName(model: string): string {
  // Convert model names to display format
  return model
    .replace(/gpt-(\d+\.\d+)-codex/, 'GPT-$1 Codex')
    .replace(/gpt-4o/, 'GPT-4o')
    .replace(/gpt-4o-mini/, 'GPT-4o-mini')
    .replace(/o1/, 'o1')
    .replace(/o1-mini/, 'o1-mini');
}

export function formatModelsList(models: Map<string, number>): string[] {
  return Array.from(models.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3) // Top 3 models
    .map(([model, tokens]) => {
      const displayName = getModelDisplayName(model);
      const tokenCount = formatCompactNumber(tokens);
      return `${displayName} (${tokenCount})`;
    });
}

export function formatUsageBreakdown(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number
): string {
  const parts = [];
  if (inputTokens > 0) parts.push(`In: ${formatNumber(inputTokens)}`);
  if (outputTokens > 0) parts.push(`Out: ${formatNumber(outputTokens)}`);
  if (cachedTokens > 0) parts.push(`Cache: ${formatNumber(cachedTokens)}`);
  return parts.join(' | ');
}

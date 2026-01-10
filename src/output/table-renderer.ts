import Table from 'cli-table3';
import chalk from 'chalk';
import {
  DirectoryUsage,
  DateUsage,
  ModelUsage,
  AggregatedData,
} from '../aggregator/types.js';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '../calculator/cost-calculator.js';
import {
  formatDateForDisplay,
  truncatePath,
  formatModelsList,
  getModelDisplayName,
} from './formatters.js';

interface TableConfig {
  head: string[];
  colAligns: ('left' | 'center' | 'right')[];
  compactHead?: string[];
  compactColAligns?: ('left' | 'center' | 'right')[];
  compactThreshold?: number;
}

export class TableRenderer {
  private terminalWidth: number;

  constructor() {
    this.terminalWidth = process.stdout.columns || 120;
  }

  renderRepositoryTable(
    directories: DirectoryUsage[],
    totalTokens: number,
    totalCost: number,
    options: { limit?: number; json?: boolean } = {}
  ): string {
    const { limit, json } = options;

    if (json) {
      return JSON.stringify({
        type: 'repository',
        totalTokens,
        totalCost,
        directories: directories.map(dir => ({
          path: dir.displayPath,
          totalTokens: dir.totalTokens,
          inputTokens: dir.inputTokens,
          cachedInputTokens: dir.cachedInputTokens,
          outputTokens: dir.outputTokens,
          costUSD: dir.costUSD,
          percentage: formatPercentage(dir.totalTokens, totalTokens),
          sessions: dir.sessionCount,
          models: Object.fromEntries(dir.models),
        })),
      }, null, 2);
    }

    const displayDirs = limit ? directories.slice(0, limit) : directories;
    
    // Calculate "Other" totals
    const otherDirs = directories.slice(limit || directories.length);
    const otherTokens = otherDirs.reduce((sum, d) => sum + d.totalTokens, 0);
    const otherCost = otherDirs.reduce((sum, d) => sum + d.costUSD, 0);
    const otherFreshInput = otherDirs.reduce((sum, d) => sum + (d.inputTokens - d.cachedInputTokens), 0);
    const otherCached = otherDirs.reduce((sum, d) => sum + d.cachedInputTokens, 0);
    const otherOutput = otherDirs.reduce((sum, d) => sum + d.outputTokens, 0);

    const table = new Table({
      head: [
        chalk.cyan('Repository'),
        chalk.cyan('Fresh Input'),
        chalk.cyan('Cache Read'),
        chalk.cyan('Output'),
        chalk.cyan('Total Tokens'),
        chalk.cyan('Cost'),
        chalk.cyan('% Total'),
      ],
      colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
      style: { head: [], border: [] },
    } as TableConfig);

    for (const dir of displayDirs) {
      table.push([
        truncatePath(dir.displayPath),
        formatNumber(dir.inputTokens - dir.cachedInputTokens),
        formatNumber(dir.cachedInputTokens),
        formatNumber(dir.outputTokens),
        formatNumber(dir.totalTokens),
        formatCurrency(dir.costUSD),
        formatPercentage(dir.totalTokens, totalTokens),
      ]);
    }

    // Add "Other" row if we're limiting
    if (limit && otherTokens > 0) {
      table.push([
        chalk.dim(`Other (${directories.length - limit} repos)`),
        formatNumber(otherFreshInput),
        formatNumber(otherCached),
        formatNumber(otherOutput),
        formatNumber(otherTokens),
        formatCurrency(otherCost),
        formatPercentage(otherTokens, totalTokens),
      ]);
    }

    // Calculate totals
    const totalInput = directories.reduce((sum, d) => sum + d.inputTokens, 0);
    const totalCached = directories.reduce((sum, d) => sum + d.cachedInputTokens, 0);
    const totalOutput = directories.reduce((sum, d) => sum + d.outputTokens, 0);
    const totalFreshInput = totalInput - totalCached;

    // Add totals row
    table.push([
      chalk.yellow('TOTAL'),
      chalk.yellow(formatNumber(totalFreshInput)),
      chalk.yellow(formatNumber(totalCached)),
      chalk.yellow(formatNumber(totalOutput)),
      chalk.yellow(formatNumber(totalTokens)),
      chalk.yellow(formatCurrency(totalCost)),
      chalk.yellow('100%'),
    ]);

    return table.toString();
  }

  renderDailyTable(
    dates: DateUsage[],
    totalTokens: number,
    totalCost: number,
    options: { json?: boolean } = {}
  ): string {
    const { json } = options;

    if (json) {
      return JSON.stringify({
        type: 'daily',
        totalTokens,
        totalCost,
        dates: dates.map(date => ({
          date: date.date,
          totalTokens: date.totalTokens,
          inputTokens: date.inputTokens,
          cachedInputTokens: date.cachedInputTokens,
          outputTokens: date.outputTokens,
          costUSD: date.costUSD,
          sessions: date.sessionCount,
          models: Object.fromEntries(date.models),
        })),
      }, null, 2);
    }

    const table = new Table({
      head: [
        chalk.cyan('Date'),
        chalk.cyan('Fresh Input'),
        chalk.cyan('Cache Read'),
        chalk.cyan('Output'),
        chalk.cyan('Total Tokens'),
        chalk.cyan('Cost'),
        chalk.cyan('Sessions'),
      ],
      colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
      style: { head: [], border: [] },
    } as TableConfig);

    for (const date of dates) {
      table.push([
        formatDateForDisplay(date.date),
        formatNumber(date.inputTokens - date.cachedInputTokens),
        formatNumber(date.cachedInputTokens),
        formatNumber(date.outputTokens),
        formatNumber(date.totalTokens),
        formatCurrency(date.costUSD),
        date.sessionCount.toString(),
      ]);
    }

    // Calculate totals
    const totalInput = dates.reduce((sum, d) => sum + d.inputTokens, 0);
    const totalCached = dates.reduce((sum, d) => sum + d.cachedInputTokens, 0);
    const totalOutput = dates.reduce((sum, d) => sum + d.outputTokens, 0);

    // Add totals row
    table.push([
      chalk.yellow('TOTAL'),
      chalk.yellow(formatNumber(totalInput - totalCached)),
      chalk.yellow(formatNumber(totalCached)),
      chalk.yellow(formatNumber(totalOutput)),
      chalk.yellow(formatNumber(totalTokens)),
      chalk.yellow(formatCurrency(totalCost)),
      chalk.yellow(dates.reduce((sum, d) => sum + d.sessionCount, 0).toString()),
    ]);

    return table.toString();
  }

  renderModelTable(
    models: ModelUsage[],
    totalTokens: number,
    totalCost: number,
    options: { json?: boolean } = {}
  ): string {
    const { json } = options;

    if (json) {
      return JSON.stringify({
        type: 'model',
        totalTokens,
        totalCost,
        models: models.map(model => ({
          model: model.model,
          displayName: getModelDisplayName(model.model),
          totalTokens: model.totalTokens,
          inputTokens: model.inputTokens,
          cachedInputTokens: model.cachedInputTokens,
          outputTokens: model.outputTokens,
          costUSD: model.costUSD,
          percentage: formatPercentage(model.totalTokens, totalTokens),
          sessions: model.sessionCount,
        })),
      }, null, 2);
    }

    const table = new Table({
      head: [
        chalk.cyan('Model'),
        chalk.cyan('Fresh Input'),
        chalk.cyan('Cache Read'),
        chalk.cyan('Output'),
        chalk.cyan('Total Tokens'),
        chalk.cyan('Cost'),
        chalk.cyan('% Total'),
        chalk.cyan('Sessions'),
      ],
      colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
      style: { head: [], border: [] },
    } as TableConfig);

    for (const model of models) {
      table.push([
        getModelDisplayName(model.model),
        formatNumber(model.inputTokens - model.cachedInputTokens),
        formatNumber(model.cachedInputTokens),
        formatNumber(model.outputTokens),
        formatNumber(model.totalTokens),
        formatCurrency(model.costUSD),
        formatPercentage(model.totalTokens, totalTokens),
        model.sessionCount.toString(),
      ]);
    }

    // Calculate totals
    const totalInput = models.reduce((sum, m) => sum + m.inputTokens, 0);
    const totalCached = models.reduce((sum, m) => sum + m.cachedInputTokens, 0);
    const totalOutput = models.reduce((sum, m) => sum + m.outputTokens, 0);

    // Add totals row
    table.push([
      chalk.yellow('TOTAL'),
      chalk.yellow(formatNumber(totalInput - totalCached)),
      chalk.yellow(formatNumber(totalCached)),
      chalk.yellow(formatNumber(totalOutput)),
      chalk.yellow(formatNumber(totalTokens)),
      chalk.yellow(formatCurrency(totalCost)),
      chalk.yellow('100%'),
      chalk.yellow(models.reduce((sum, m) => sum + m.sessionCount, 0).toString()),
    ]);

    return table.toString();
  }

  renderSummary(data: AggregatedData): string {
    const lines: string[] = [];

    lines.push(chalk.cyan('═══════════════════════════════════════════════════════════'));
    lines.push(chalk.cyan('              Codex Token Usage Summary'));
    lines.push(chalk.cyan('═══════════════════════════════════════════════════════════'));
    lines.push('');

    const totalCost = data.directories.reduce((sum, d) => sum + d.costUSD, 0);
    const totalInputTokens = data.directories.reduce((sum, d) => sum + d.inputTokens, 0);
    const totalOutputTokens = data.directories.reduce((sum, d) => sum + d.outputTokens, 0);

    lines.push(`  ${chalk.bold('Total Tokens:')}  ${formatNumber(data.totalTokens)}`);
    lines.push(`  ${chalk.bold('Total Cost:')}    ${formatCurrency(totalCost)}`);
    lines.push(`  ${chalk.bold('Sessions:')}     ${data.totalSessions}`);
    lines.push(`  ${chalk.bold('Repositories:')} ${data.directories.length}`);
    lines.push('');
    lines.push(`  ${chalk.bold('Input Tokens:')}  ${formatNumber(totalInputTokens)}`);
    lines.push(`  ${chalk.bold('Output Tokens:')} ${formatNumber(totalOutputTokens)}`);
    lines.push('');
    lines.push(chalk.cyan('═══════════════════════════════════════════════════════════'));

    return lines.join('\n');
  }
}

export function renderHeader(title: string, dateRange?: { start: Date; end: Date }): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('╔' + '═'.repeat(60) + '╗'));
  lines.push(chalk.cyan('║') + chalk.white(` ${title}`).padEnd(60) + chalk.cyan('║'));
  lines.push(chalk.cyan('╚' + '═'.repeat(60) + '╝'));

  if (dateRange) {
    const startStr = formatDateForDisplay(dateRange.start.toISOString());
    const endStr = formatDateForDisplay(dateRange.end.toISOString());
    lines.push(chalk.dim(`  ${startStr} - ${endStr}`));
    lines.push('');
  }

  return lines.join('\n');
}

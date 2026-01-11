import { Command } from 'commander';
import { SessionReader } from '../parser/index.js';
import { Aggregator } from '../aggregator/index.js';
import {
  calculateDirectoryCosts,
  calculateDateCosts,
  calculateModelCosts,
} from '../calculator/cost-calculator.js';
import { TableRenderer, renderHeader } from '../output/index.js';
import { formatDateForDisplay } from '../output/formatters.js';
import { logError, logInfo, logSuccess } from '../utils/logger.js';
import { subDays, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('codex-usage')
    .description('Track and analyze OpenAI Codex CLI token usage by repository')
    .version('1.0.0');

  // Global options
  program.option('--json', 'Output as JSON');
  program.option('--codex-dir <path>', 'Codex data directory', '~/.codex');

  // repos command
  program
    .command('repos')
    .description('Show token usage by repository')
    .option('--since <date>', 'Start date (YYYY-MM-DD or relative: 7days, 1month)')
    .option('--until <date>', 'End date (YYYY-MM-DD)')
    .option('--top <n>', 'Show only top N repositories', parseInt)
    .option('--codex-dir <path>', 'Codex data directory', '~/.codex')
    .action(async (options) => {
      await handleReposCommand(program.opts(), options);
    });

  // daily command
  program
    .command('daily')
    .description('Show daily token usage')
    .option('--since <date>', 'Start date (YYYY-MM-DD or relative: 7days, 1month)')
    .option('--until <date>', 'End date (YYYY-MM-DD)')
    .option('--dir <path>', 'Filter by directory prefix')
    .option('--repo <name>', 'Filter by repository name')
    .option('--codex-dir <path>', 'Codex data directory', '~/.codex')
    .action(async (options) => {
      await handleDailyCommand(program.opts(), options);
    });

  // models command
  program
    .command('models')
    .description('Show token usage by model')
    .option('--codex-dir <path>', 'Codex data directory', '~/.codex')
    .action(async (options) => {
      await handleModelsCommand(program.opts(), options);
    });

  // summary command
  program
    .command('summary')
    .description('Show overall usage summary')
    .option('--codex-dir <path>', 'Codex data directory', '~/.codex')
    .action(async (options) => {
      await handleSummaryCommand(program.opts(), options);
    });

  return program;
}

async function handleReposCommand(globalOpts: any, options: any) {
  try {
    // Get codex directory, default to ~/.codex
    const codexDir = globalOpts.codexDir && globalOpts.codexDir !== '~/.codex' 
      ? globalOpts.codexDir 
      : undefined;
    
    const reader = new SessionReader(codexDir);
    const sessions = reader.readAllSessions();

    if (sessions.length === 0) {
      console.log('No Codex sessions found.');
      return;
    }

    let aggregator = new Aggregator(sessions);

    // Apply date filters
    const dateRange = parseDateRange(options.since, options.until);
    if (dateRange.start || dateRange.end) {
      aggregator = aggregator.filterByDateRange(
        dateRange.start || new Date(0),
        dateRange.end || new Date()
      );
    }

    const data = aggregator.aggregate();
    const directoriesWithCosts = calculateDirectoryCosts(data.directories);

    const totalTokens = directoriesWithCosts.reduce((sum, d) => sum + d.totalTokens, 0);
    const totalCost = directoriesWithCosts.reduce((sum, d) => sum + d.costUSD, 0);

    console.log(renderHeader('Codex Token Usage by Repository', data.dateRange));

    const renderer = new TableRenderer();
    console.log(
      renderer.renderRepositoryTable(directoriesWithCosts, totalTokens, totalCost, {
        limit: options.top,
        json: globalOpts.json,
      })
    );

    if (globalOpts.json) return;

    // Show model distribution
    if (data.models.length > 0) {
      console.log('\n' + chalk.cyan('🤖 Model Distribution'));
      console.log('─'.repeat(50));
      const modelsWithCosts = calculateModelCosts(data.models);
      for (const model of modelsWithCosts.slice(0, 5)) {
        const pct = ((model.totalTokens / totalTokens) * 100).toFixed(1);
        console.log(`  ${model.model.padEnd(20)} ${formatNumber(model.totalTokens).padEnd(12)} ${pct}%`);
      }
    }
  } catch (error) {
    console.error('Error generating repository report:', error);
    process.exit(1);
  }
}

async function handleDailyCommand(globalOpts: any, options: any) {
  try {
    logInfo('daily_command_started', {
      since: options.since ?? null,
      until: options.until ?? null,
      dir: options.dir ?? null,
      repo: options.repo ?? null,
    });

    const codexDir = globalOpts.codexDir && globalOpts.codexDir !== '~/.codex' 
      ? globalOpts.codexDir 
      : undefined;

    const reader = new SessionReader(codexDir);
    const sessions = reader.readAllSessions();

    logInfo('daily_sessions_loaded', { count: sessions.length });

    if (sessions.length === 0) {
      logInfo('daily_no_sessions');
      console.log('No Codex sessions found.');
      return;
    }

    let aggregator = new Aggregator(sessions);

    const dateRange = parseDateRange(options.since, options.until);
    if (dateRange.start || dateRange.end) {
      logInfo('daily_date_filter_applied', {
        start: dateRange.start?.toISOString() ?? null,
        end: dateRange.end?.toISOString() ?? null,
      });

      aggregator = aggregator.filterByDateRange(
        dateRange.start || new Date(0),
        dateRange.end || new Date()
      );
    }

    if (options.repo) {
      const repoMap = aggregator.getRepoNameMap();
      const knownRepoNames = Array.from(repoMap.keys()).sort();
      const matchCount = repoMap.get(options.repo)?.size ?? 0;

      if (matchCount !== 1) {
        const detail = matchCount === 0 ? 'No matching repository name.' : 'Repository name is ambiguous.';
        const knownList = knownRepoNames.length > 0 ? knownRepoNames.join(', ') : 'none';

        console.error(`${detail} Known repo names: ${knownList}`);
        logError('daily_repo_match_failed', {
          repo: options.repo,
          matchCount,
          knownRepoNames,
        });
        return;
      }

      logInfo('daily_repo_filter_applied', { repo: options.repo });
      aggregator = aggregator.filterByRepoName(options.repo);
    }

    if (options.dir) {
      logInfo('daily_dir_filter_applied', { dir: options.dir });
      aggregator = aggregator.filterByDirectory(options.dir);
    }

    const data = aggregator.aggregate();
    const datesWithCosts = calculateDateCosts(data.dates);

    const totalTokens = datesWithCosts.reduce((sum, d) => sum + d.totalTokens, 0);
    const totalCost = datesWithCosts.reduce((sum, d) => sum + d.costUSD, 0);

    console.log(renderHeader('Codex Daily Token Usage', data.dateRange));

    const renderer = new TableRenderer();
    console.log(
      renderer.renderDailyTable(datesWithCosts, totalTokens, totalCost, {
        json: globalOpts.json,
      })
    );

    logSuccess('daily_report_rendered', {
      days: datesWithCosts.length,
      totalTokens,
      totalCost,
    });
  } catch (error) {
    logError('daily_report_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('Error generating daily report:', error);
    process.exit(1);
  }
}

async function handleModelsCommand(globalOpts: any, options: any) {
  try {
    // Get codex directory, default to ~/.codex
    const codexDir = globalOpts.codexDir && globalOpts.codexDir !== '~/.codex' 
      ? globalOpts.codexDir 
      : undefined;
    
    const reader = new SessionReader(codexDir);
    const sessions = reader.readAllSessions();

    if (sessions.length === 0) {
      console.log('No Codex sessions found.');
      return;
    }

    const aggregator = new Aggregator(sessions);
    const data = aggregator.aggregate();
    const modelsWithCosts = calculateModelCosts(data.models);

    const totalTokens = modelsWithCosts.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = modelsWithCosts.reduce((sum, m) => sum + m.costUSD, 0);

    console.log(renderHeader('Codex Token Usage by Model'));

    const renderer = new TableRenderer();
    console.log(
      renderer.renderModelTable(modelsWithCosts, totalTokens, totalCost, {
        json: globalOpts.json,
      })
    );
  } catch (error) {
    console.error('Error generating model report:', error);
    process.exit(1);
  }
}

async function handleSummaryCommand(globalOpts: any, options: any) {
  try {
    // Get codex directory, default to ~/.codex
    const codexDir = globalOpts.codexDir && globalOpts.codexDir !== '~/.codex' 
      ? globalOpts.codexDir 
      : undefined;
    
    const reader = new SessionReader(codexDir);
    const sessions = reader.readAllSessions();

    if (sessions.length === 0) {
      console.log('No Codex sessions found.');
      return;
    }

    const aggregator = new Aggregator(sessions);
    const data = aggregator.aggregate();

    const renderer = new TableRenderer();
    console.log(renderer.renderSummary(data));
  } catch (error) {
    console.error('Error generating summary:', error);
    process.exit(1);
  }
}

function parseDateRange(
  since?: string,
  until?: string
): { start?: Date; end?: Date } {
  const result: { start?: Date; end?: Date } = {};

  if (since) {
    // Try parsing as relative date
    if (since.endsWith('days') || since.endsWith('day')) {
      const num = parseInt(since);
      if (!isNaN(num)) {
        result.start = subDays(new Date(), num);
      }
    } else if (since.endsWith('months') || since.endsWith('month')) {
      const num = parseInt(since);
      if (!isNaN(num)) {
        result.start = subDays(new Date(), num * 30);
      }
    } else {
      // Try parsing as YYYY-MM-DD
      const date = parseISO(since);
      if (isValid(date)) {
        result.start = startOfDay(date);
      }
    }
  }

  if (until) {
    const date = parseISO(until);
    if (isValid(date)) {
      result.end = endOfDay(date);
    }
  }

  return result;
}

// Import chalk at the top level
import chalk from 'chalk';
import { formatNumber } from '../calculator/cost-calculator.js';

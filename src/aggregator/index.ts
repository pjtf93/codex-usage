import { ParsedSession, TokenUsageEvent } from '../parser/types.js';
import {
  DirectoryUsage,
  DateUsage,
  ModelUsage,
  AggregatedData,
  SortField,
  SortDirection,
} from './types.js';
import { format } from 'date-fns';

export function extractRepoNameFromUrl(repoUrl: string): string | null {
  if (!repoUrl) {
    return null;
  }

  const trimmed = repoUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(':', '/');
  const parts = normalized.split('/');
  const lastSegment = parts[parts.length - 1];

  if (!lastSegment) {
    return null;
  }

  const cleaned = lastSegment.replace(/\.git$/i, '');
  return cleaned || null;
}

export class Aggregator {
  private sessions: ParsedSession[];

  constructor(sessions: ParsedSession[]) {
    this.sessions = sessions;
  }

  aggregate(): AggregatedData {
    const allEvents = this.sessions.flatMap(s => s.events);

    if (allEvents.length === 0) {
      return {
        directories: [],
        dates: [],
        models: [],
        totalTokens: 0,
        totalCost: 0,
        totalSessions: 0,
        dateRange: { start: new Date(), end: new Date() },
      };
    }

    const sortedEvents = allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      directories: this.aggregateByDirectory(),
      dates: this.aggregateByDate(),
      models: this.aggregateByModel(),
      totalTokens: sortedEvents.reduce((sum, e) => sum + e.totalTokens, 0),
      totalCost: 0, // Will be calculated by cost calculator
      totalSessions: this.sessions.length,
      dateRange: {
        start: sortedEvents[0]!.timestamp,
        end: sortedEvents[sortedEvents.length - 1]!.timestamp,
      },
    };
  }

  aggregateByDirectory(): DirectoryUsage[] {
    const directoryMap = new Map<string, DirectoryUsage>();

    for (const session of this.sessions) {
      const displayPath = this.normalizePath(session.cwd);

      if (!directoryMap.has(displayPath)) {
        directoryMap.set(displayPath, {
          path: session.cwd,
          displayPath,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          reasoningOutputTokens: 0,
          costUSD: 0,
          sessionCount: 0,
          eventCount: 0,
          models: new Map(),
        });
      }

      const dirUsage = directoryMap.get(displayPath)!;
      dirUsage.sessionCount++;

      for (const event of session.events) {
        dirUsage.totalTokens += event.totalTokens;
        dirUsage.inputTokens += event.inputTokens;
        dirUsage.outputTokens += event.outputTokens;
        dirUsage.cachedInputTokens += event.cachedInputTokens;
        dirUsage.reasoningOutputTokens += event.reasoningOutputTokens;
        dirUsage.eventCount++;

        const modelCount = dirUsage.models.get(event.model) || 0;
        dirUsage.models.set(event.model, modelCount + event.totalTokens);
      }
    }

    return Array.from(directoryMap.values())
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }

  aggregateByDate(): DateUsage[] {
    const dateMap = new Map<string, DateUsage>();

    for (const session of this.sessions) {
      for (const event of session.events) {
        const dateKey = format(event.timestamp, 'yyyy-MM-dd');

        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            date: dateKey,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            cachedInputTokens: 0,
            reasoningOutputTokens: 0,
            costUSD: 0,
            sessionCount: 0,
            eventCount: 0,
            models: new Map(),
          });
        }

        const dateUsage = dateMap.get(dateKey)!;

        dateUsage.totalTokens += event.totalTokens;
        dateUsage.inputTokens += event.inputTokens;
        dateUsage.outputTokens += event.outputTokens;
        dateUsage.cachedInputTokens += event.cachedInputTokens;
        dateUsage.reasoningOutputTokens += event.reasoningOutputTokens;
        dateUsage.eventCount++;

        const modelCount = dateUsage.models.get(event.model) || 0;
        dateUsage.models.set(event.model, modelCount + event.totalTokens);
      }
    }

    // Count unique sessions per date
    const sessionDates = new Map<string, Set<string>>();
    for (const session of this.sessions) {
      for (const event of session.events) {
        const dateKey = format(event.timestamp, 'yyyy-MM-dd');
        if (!sessionDates.has(dateKey)) {
          sessionDates.set(dateKey, new Set());
        }
        sessionDates.get(dateKey)!.add(session.sessionId);
      }
    }

    for (const [dateKey, sessions] of sessionDates) {
      if (dateMap.has(dateKey)) {
        dateMap.get(dateKey)!.sessionCount = sessions.size;
      }
    }

    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  aggregateByModel(): ModelUsage[] {
    const modelMap = new Map<string, ModelUsage>();

    for (const session of this.sessions) {
      for (const event of session.events) {
        if (!modelMap.has(event.model)) {
          modelMap.set(event.model, {
            model: event.model,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            cachedInputTokens: 0,
            reasoningOutputTokens: 0,
            costUSD: 0,
            sessionCount: 0,
            eventCount: 0,
          });
        }

        const modelUsage = modelMap.get(event.model)!;
        modelUsage.totalTokens += event.totalTokens;
        modelUsage.inputTokens += event.inputTokens;
        modelUsage.outputTokens += event.outputTokens;
        modelUsage.cachedInputTokens += event.cachedInputTokens;
        modelUsage.reasoningOutputTokens += event.reasoningOutputTokens;
        modelUsage.eventCount++;
      }
    }

    // Count unique sessions per model
    const modelSessions = new Map<string, Set<string>>();
    for (const session of this.sessions) {
      for (const event of session.events) {
        if (!modelSessions.has(event.model)) {
          modelSessions.set(event.model, new Set());
        }
        modelSessions.get(event.model)!.add(session.sessionId);
      }
    }

    for (const [model, sessions] of modelSessions) {
      if (modelMap.has(model)) {
        modelMap.get(model)!.sessionCount = sessions.size;
      }
    }

    return Array.from(modelMap.values())
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }

  private normalizePath(cwd: string): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    // Replace home directory with ~
    if (cwd.startsWith(homeDir)) {
      cwd = cwd.replace(homeDir, '~');
    }

    // Remove trailing slashes
    cwd = cwd.replace(/\/+$/, '');

    return cwd;
  }

  filterByDateRange(start: Date, end: Date): Aggregator {
    const filteredSessions = this.sessions.filter(session =>
      session.events.some(event =>
        event.timestamp >= start && event.timestamp <= end
      )
    );

    return new Aggregator(filteredSessions);
  }

  filterByDirectory(path: string): Aggregator {
    const normalizedPath = this.normalizePath(path);
    const filteredSessions = this.sessions.filter(session =>
      this.normalizePath(session.cwd).startsWith(normalizedPath)
    );

    return new Aggregator(filteredSessions);
  }

  filterByModel(model: string): Aggregator {
    const filteredSessions = this.sessions.filter(session =>
      session.events.some(event => event.model === model)
    );

    return new Aggregator(filteredSessions);
  }

  getRepoNameMap(): Map<string, Set<string>> {
    const repoMap = new Map<string, Set<string>>();

    for (const session of this.sessions) {
      if (!session.gitRepo) {
        continue;
      }

      const repoName = extractRepoNameFromUrl(session.gitRepo);
      if (!repoName) {
        continue;
      }

      if (!repoMap.has(repoName)) {
        repoMap.set(repoName, new Set());
      }

      repoMap.get(repoName)!.add(session.gitRepo);
    }

    return repoMap;
  }

  filterByRepoName(repoName: string): Aggregator {
    const filteredSessions = this.sessions.filter(session => {
      if (!session.gitRepo) {
        return false;
      }

      const extracted = extractRepoNameFromUrl(session.gitRepo);
      return extracted === repoName;
    });

    return new Aggregator(filteredSessions);
  }
}

export function sortDirectoryUsage(
  directories: DirectoryUsage[],
  field: SortField,
  direction: SortDirection
): DirectoryUsage[] {
  const sorted = [...directories].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'tokens':
        comparison = a.totalTokens - b.totalTokens;
        break;
      case 'cost':
        comparison = a.costUSD - b.costUSD;
        break;
      default:
        comparison = 0;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

export function sortDateUsage(
  dates: DateUsage[],
  direction: SortDirection
): DateUsage[] {
  return [...dates].sort((a, b) => {
    const comparison = a.date.localeCompare(b.date);
    return direction === 'asc' ? comparison : -comparison;
  });
}

export function sortModelUsage(
  models: ModelUsage[],
  field: SortField,
  direction: SortDirection
): ModelUsage[] {
  const sorted = [...models].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'tokens':
        comparison = a.totalTokens - b.totalTokens;
        break;
      case 'cost':
        comparison = a.costUSD - b.costUSD;
        break;
      default:
        comparison = 0;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

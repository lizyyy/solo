import { LogEntry, StageAggregation, CacheHitStatus, CacheKeyComparison } from './types';
import { CACHE_HIT_STATUS } from './constants';

export class StageAggregator {
  aggregate(entries: LogEntry[]): StageAggregation[] {
    const stageMap = new Map<string, LogEntry[]>();

    for (const entry of entries) {
      const stage = entry.stage || 'unknown';
      if (!stageMap.has(stage)) {
        stageMap.set(stage, []);
      }
      stageMap.get(stage)!.push(entry);
    }

    const aggregations: StageAggregation[] = [];
    for (const [name, stageEntries] of stageMap) {
      aggregations.push(this.aggregateStage(name, stageEntries));
    }

    return aggregations.sort((a, b) => b.totalDurationMs - a.totalDurationMs);
  }

  private aggregateStage(name: string, entries: LogEntry[]): StageAggregation {
    const hitCount = this.countByStatus(entries, CACHE_HIT_STATUS.HIT);
    const missCount = this.countByStatus(entries, CACHE_HIT_STATUS.MISS);
    const partialCount = this.countByStatus(entries, CACHE_HIT_STATUS.PARTIAL);
    const unknownCount = this.countByStatus(entries, CACHE_HIT_STATUS.UNKNOWN);

    const durations = entries
      .filter(e => e.durationMs !== undefined)
      .map(e => e.durationMs!);

    const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
    const avgDurationMs = durations.length > 0 
      ? Math.round(totalDurationMs / durations.length) 
      : 0;

    const cacheKeys = [...new Set(
      entries
        .filter(e => e.cacheKey)
        .map(e => e.cacheKey!)
    )];

    return {
      name,
      totalEntries: entries.length,
      hitCount,
      missCount,
      partialCount,
      unknownCount,
      totalDurationMs,
      avgDurationMs,
      cacheKeys,
    };
  }

  private countByStatus(entries: LogEntry[], status: CacheHitStatus): number {
    return entries.filter(e => e.hitStatus === status).length;
  }
}

export class CacheKeyComparer {
  compare(entries: LogEntry[]): CacheKeyComparison[] {
    const stageKeys = this.groupKeysByStage(entries);
    const comparisons: CacheKeyComparison[] = [];

    for (const [stage, keys] of stageKeys) {
      const stageComparisons = this.compareKeysInStage(stage, keys);
      comparisons.push(...stageComparisons);
    }

    return comparisons;
  }

  private groupKeysByStage(entries: LogEntry[]): Map<string, string[]> {
    const stageMap = new Map<string, Set<string>>();

    for (const entry of entries) {
      if (!entry.cacheKey) continue;
      
      const stage = entry.stage || 'unknown';
      if (!stageMap.has(stage)) {
        stageMap.set(stage, new Set());
      }
      stageMap.get(stage)!.add(entry.cacheKey);
    }

    const result = new Map<string, string[]>();
    for (const [stage, keys] of stageMap) {
      result.set(stage, [...keys]);
    }
    return result;
  }

  private compareKeysInStage(stage: string, keys: string[]): CacheKeyComparison[] {
    const comparisons: CacheKeyComparison[] = [];

    for (let i = 0; i < keys.length; i++) {
      const currentKey = keys[i];
      const previousKey = i > 0 ? keys[i - 1] : undefined;

      const isChanged = previousKey !== undefined && currentKey !== previousKey;
      const changedParts = isChanged 
        ? this.findChangedParts(currentKey, previousKey!)
        : undefined;

      comparisons.push({
        key: currentKey,
        previousKey,
        isChanged,
        changedParts,
        stage,
      });
    }

    return comparisons;
  }

  private findChangedParts(current: string, previous: string): string[] {
    const currentParts = current.split(/[-\s]+/);
    const previousParts = previous.split(/[-\s]+/);
    
    const changedParts: string[] = [];
    const maxLength = Math.max(currentParts.length, previousParts.length);

    for (let i = 0; i < maxLength; i++) {
      if (currentParts[i] !== previousParts[i]) {
        if (currentParts[i]) changedParts.push(`+${currentParts[i]}`);
        if (previousParts[i]) changedParts.push(`-${previousParts[i]}`);
      }
    }

    if (changedParts.length === 0) {
      changedParts.push('整体变化');
    }

    return changedParts;
  }
}

export function aggregateStages(entries: LogEntry[]): StageAggregation[] {
  const aggregator = new StageAggregator();
  return aggregator.aggregate(entries);
}

export function compareCacheKeys(entries: LogEntry[]): CacheKeyComparison[] {
  const comparer = new CacheKeyComparer();
  return comparer.compare(entries);
}

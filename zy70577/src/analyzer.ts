import { LogEntry, StageAggregation, TimeAttribution, AnalysisResult, BadLine, CLIOptions } from './types';
import { RECOMMENDATIONS, FORMAT_CONSTANTS, CACHE_HIT_STATUS } from './constants';
import { aggregateStages, compareCacheKeys } from './aggregator';

interface AnalyzerInput {
  entries: LogEntry[];
  badLines: BadLine[];
  totalLines: number;
  options: CLIOptions;
}

export class CacheAnalyzer {
  analyze(input: AnalyzerInput): AnalysisResult {
    const { entries, badLines, totalLines, options } = input;
    
    const stages = aggregateStages(entries);
    const cacheKeyChanges = compareCacheKeys(entries);
    const timeAttribution = this.calculateTimeAttribution(stages);
    
    const summary = this.calculateSummary(stages, timeAttribution);
    const recommendations = this.generateRecommendations(stages, cacheKeyChanges, timeAttribution);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        inputFile: options.input,
        totalLines,
        parsedLines: entries.length,
        badLines: badLines.length,
      },
      summary,
      stages,
      cacheKeyChanges,
      timeAttribution,
      badLines,
      recommendations,
    };
  }

  private calculateTimeAttribution(stages: StageAggregation[]): TimeAttribution[] {
    const totalDuration = stages.reduce((sum, s) => sum + s.totalDurationMs, 0);

    return stages.map(stage => {
      const cacheMissOverheadMs = this.estimateCacheMissOverhead(stage);
      const percentageOfTotal = totalDuration > 0 
        ? (stage.totalDurationMs / totalDuration) * 100 
        : 0;

      return {
        stage: stage.name,
        totalTimeMs: stage.totalDurationMs,
        cacheMissOverheadMs,
        percentageOfTotal: Math.round(percentageOfTotal * 100) / 100,
      };
    }).sort((a, b) => b.cacheMissOverheadMs - a.cacheMissOverheadMs);
  }

  private estimateCacheMissOverhead(stage: StageAggregation): number {
    if (stage.missCount === 0) return 0;
    
    const avgHitDuration = stage.hitCount > 0
      ? stage.totalDurationMs / (stage.hitCount + stage.missCount) * 0.3
      : stage.avgDurationMs * 0.3;
    
    const overheadPerMiss = Math.max(0, stage.avgDurationMs - avgHitDuration);
    
    return Math.round(stage.missCount * overheadPerMiss);
  }

  private calculateSummary(
    stages: StageAggregation[], 
    timeAttribution: TimeAttribution[]
  ) {
    const totalCacheHits = stages.reduce((sum, s) => sum + s.hitCount, 0);
    const totalCacheMisses = stages.reduce((sum, s) => sum + s.missCount, 0);
    const totalCacheChecks = totalCacheHits + totalCacheMisses;
    const hitRate = totalCacheChecks > 0 
      ? totalCacheHits / totalCacheChecks 
      : 0;

    return {
      totalStages: stages.length,
      totalCacheHits,
      totalCacheMisses,
      hitRate: Math.round(hitRate * 10000) / 10000,
      totalDurationMs: stages.reduce((sum, s) => sum + s.totalDurationMs, 0),
      cacheMissOverheadMs: timeAttribution.reduce((sum, t) => sum + t.cacheMissOverheadMs, 0),
    };
  }

  private generateRecommendations(
    stages: StageAggregation[],
    cacheKeyChanges: any[],
    timeAttribution: TimeAttribution[]
  ): string[] {
    const recommendations: string[] = [];

    const totalHits = stages.reduce((sum, s) => sum + s.hitCount, 0);
    const totalMisses = stages.reduce((sum, s) => sum + s.missCount, 0);
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 1;
    
    if (hitRate < 0.5) {
      recommendations.push(RECOMMENDATIONS.LOW_HIT_RATE);
    }

    const totalOverhead = timeAttribution.reduce((sum, t) => sum + t.cacheMissOverheadMs, 0);
    const totalDuration = timeAttribution.reduce((sum, t) => sum + t.totalTimeMs, 0);
    if (totalDuration > 0 && totalOverhead / totalDuration > 0.3) {
      recommendations.push(RECOMMENDATIONS.HIGH_MISS_OVERHEAD);
    }

    const keyChangesWithChange = cacheKeyChanges.filter(c => c.isChanged);
    if (keyChangesWithChange.length > 3) {
      recommendations.push(RECOMMENDATIONS.FREQUENT_KEY_CHANGE);
    }

    const longMissStages = timeAttribution.filter(t => 
      t.cacheMissOverheadMs > FORMAT_CONSTANTS.DURATION_THRESHOLD_MS
    );
    if (longMissStages.length > 0) {
      recommendations.push(RECOMMENDATIONS.LONG_STAGE_MISS);
    }

    return recommendations;
  }
}

export function analyzeCacheData(input: AnalyzerInput): AnalysisResult {
  const analyzer = new CacheAnalyzer();
  return analyzer.analyze(input);
}

export type CacheHitStatus = 'hit' | 'miss' | 'partial' | 'unknown';
export type ExitCode = 0 | 1 | 2 | 3;
export interface LogEntry {
    lineNumber: number;
    raw: string;
    timestamp?: string;
    stage?: string;
    cacheKey?: string;
    hitStatus?: CacheHitStatus;
    durationMs?: number;
    message?: string;
}
export interface BadLine {
    lineNumber: number;
    raw: string;
    reason: string;
}
export interface StageAggregation {
    name: string;
    totalEntries: number;
    hitCount: number;
    missCount: number;
    partialCount: number;
    unknownCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    cacheKeys: string[];
}
export interface CacheKeyComparison {
    key: string;
    previousKey?: string;
    isChanged: boolean;
    changedParts?: string[];
    stage: string;
}
export interface TimeAttribution {
    stage: string;
    totalTimeMs: number;
    cacheMissOverheadMs: number;
    percentageOfTotal: number;
}
export interface AnalysisResult {
    metadata: {
        generatedAt: string;
        inputFile: string;
        totalLines: number;
        parsedLines: number;
        badLines: number;
    };
    summary: {
        totalStages: number;
        totalCacheHits: number;
        totalCacheMisses: number;
        hitRate: number;
        totalDurationMs: number;
        cacheMissOverheadMs: number;
    };
    stages: StageAggregation[];
    cacheKeyChanges: CacheKeyComparison[];
    timeAttribution: TimeAttribution[];
    badLines: BadLine[];
    recommendations: string[];
}
export interface CLIOptions {
    input: string;
    outputJson?: string;
    outputMarkdown?: string;
    outputDir?: string;
    logFormat?: 'github-actions' | 'gitlab-ci' | 'circleci' | 'auto';
    verbose: boolean;
    quiet: boolean;
}

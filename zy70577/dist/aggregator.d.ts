import { LogEntry, StageAggregation, CacheKeyComparison } from './types';
export declare class StageAggregator {
    aggregate(entries: LogEntry[]): StageAggregation[];
    private aggregateStage;
    private countByStatus;
}
export declare class CacheKeyComparer {
    compare(entries: LogEntry[]): CacheKeyComparison[];
    private groupKeysByStage;
    private compareKeysInStage;
    private findChangedParts;
}
export declare function aggregateStages(entries: LogEntry[]): StageAggregation[];
export declare function compareCacheKeys(entries: LogEntry[]): CacheKeyComparison[];

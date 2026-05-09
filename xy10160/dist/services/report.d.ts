import { CheckResult, ReplayTask, CacheRefreshRecord } from '../types';
export declare const generateFieldMissingReport: (checkResult: CheckResult) => string;
export declare const generateReplayReport: (task: ReplayTask) => string;
export declare const generateCacheReport: (record: CacheRefreshRecord) => string;
export declare const generateComprehensiveReport: (checkResult: CheckResult, replayTask?: ReplayTask, cacheRecord?: CacheRefreshRecord) => string;
//# sourceMappingURL=report.d.ts.map
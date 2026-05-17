import { CacheHitStatus } from './types';
export declare const EXIT_CODES: {
    readonly SUCCESS: 0;
    readonly PARSE_ERROR: 1;
    readonly ANALYSIS_ERROR: 2;
    readonly OUTPUT_ERROR: 3;
};
export declare const CACHE_HIT_STATUS: Record<string, CacheHitStatus>;
export declare const LOG_PATTERNS: {
    readonly 'github-actions': {
        readonly stage: RegExp;
        readonly cacheHit: RegExp;
        readonly cacheMiss: RegExp;
        readonly cacheKey: RegExp;
        readonly duration: RegExp;
        readonly timestamp: RegExp;
    };
    readonly 'gitlab-ci': {
        readonly stage: RegExp;
        readonly cacheHit: RegExp;
        readonly cacheMiss: RegExp;
        readonly cacheKey: RegExp;
        readonly duration: RegExp;
        readonly timestamp: RegExp;
    };
    readonly circleci: {
        readonly stage: RegExp;
        readonly cacheHit: RegExp;
        readonly cacheMiss: RegExp;
        readonly cacheKey: RegExp;
        readonly duration: RegExp;
        readonly timestamp: RegExp;
    };
};
export declare const RECOMMENDATIONS: {
    readonly LOW_HIT_RATE: "缓存命中率低于50%，建议检查缓存键配置或增加缓存粒度";
    readonly HIGH_MISS_OVERHEAD: "缓存未命中导致显著额外耗时，建议优化构建流程";
    readonly FREQUENT_KEY_CHANGE: "缓存键频繁变化，考虑使用更稳定的缓存键";
    readonly LONG_STAGE_MISS: "某个阶段缓存未命中耗时过长，建议拆分或优化";
};
export declare const FORMAT_CONSTANTS: {
    readonly TIMESTAMP_FORMAT: "YYYY-MM-DD HH:mm:ss";
    readonly DURATION_THRESHOLD_MS: 60000;
    readonly DEFAULT_HIT_RATE_THRESHOLD: 0.7;
};

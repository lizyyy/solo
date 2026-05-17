import { CacheHitStatus } from './types';

export const EXIT_CODES = {
  SUCCESS: 0,
  PARSE_ERROR: 1,
  ANALYSIS_ERROR: 2,
  OUTPUT_ERROR: 3,
} as const;

export const CACHE_HIT_STATUS: Record<string, CacheHitStatus> = {
  HIT: 'hit',
  MISS: 'miss',
  PARTIAL: 'partial',
  UNKNOWN: 'unknown',
} as const;

export const LOG_PATTERNS = {
  'github-actions': {
    stage: /##\[group\](.+)/,
    cacheHit: /Cache restored from key: (.+)/,
    cacheMiss: /Cache not found for input keys: (.+)/,
    cacheKey: /Cache key: (.+)/,
    duration: /in (\d+)ms|took (\d+)ms|(\d+\.\d+)s/,
    timestamp: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  },
  'gitlab-ci': {
    stage: /^stage:\s*(.+)/i,
    cacheHit: /Restoring cache\s*\.\.\.\s*Checking cache for (.+?)\.\.\./,
    cacheMiss: /No cache found for (.+)/,
    cacheKey: /cache key: (.+)/i,
    duration: /Duration: (\d+) seconds?/,
    timestamp: /^\[\d{2}:\d{2}:\d{2}\]/,
  },
  'circleci': {
    stage: /^======\s*(.+?)\s*======/,
    cacheHit: /Found a cache from build \d+: (.+)/,
    cacheMiss: /No cache found/,
    cacheKey: /using cache key: (.+)/i,
    duration: /in (\d+)ms|(\d+) seconds?/,
    timestamp: /^\w{3}\s+\d{2}\s+\d{2}:\d{2}:\d{2}/,
  },
} as const;

export const RECOMMENDATIONS = {
  LOW_HIT_RATE: '缓存命中率低于50%，建议检查缓存键配置或增加缓存粒度',
  HIGH_MISS_OVERHEAD: '缓存未命中导致显著额外耗时，建议优化构建流程',
  FREQUENT_KEY_CHANGE: '缓存键频繁变化，考虑使用更稳定的缓存键',
  LONG_STAGE_MISS: '某个阶段缓存未命中耗时过长，建议拆分或优化',
} as const;

export const FORMAT_CONSTANTS = {
  TIMESTAMP_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  DURATION_THRESHOLD_MS: 60000,
  DEFAULT_HIT_RATE_THRESHOLD: 0.7,
} as const;

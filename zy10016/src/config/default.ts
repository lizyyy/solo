import { DatabaseConfig, RetryConfig, CacheConfig } from '../types';

const defaultRetryConfig: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 3000,
  backoffMultiplier: 2,
  jitterRange: [0.8, 1.2],
};

const defaultCacheConfig: CacheConfig = {
  defaultTTL: 5 * 60 * 1000,
  maxSize: 1000,
  cleanupInterval: 60 * 1000,
};

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  dbPath: './data/app.db',
  journalMode: 'WAL',
  busyTimeout: 5000,
  synchronous: 'NORMAL',
  walAutocheckpoint: 1000,
  cacheSize: 2000,
  maxPoolSize: 10,
  retryConfig: defaultRetryConfig,
};

export { defaultRetryConfig, defaultCacheConfig };

export const LOCK_ERROR_CODES = [
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SQLITE_BUSY_SNAPSHOT',
  'SQLITE_BUSY_RECOVERY',
  'SQLITE_IOERR_LOCK',
];

export function isLockError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string };
  return LOCK_ERROR_CODES.includes(err.code || '');
}

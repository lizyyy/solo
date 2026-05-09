export type LockType = 'NONE' | 'SHARED' | 'RESERVED' | 'PENDING' | 'EXCLUSIVE';

export type TransactionState = 'IDLE' | 'PENDING' | 'ACTIVE' | 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';

export type OperationType = 'READ' | 'WRITE' | 'BEGIN_TRANSACTION' | 'COMMIT' | 'ROLLBACK';

export interface DatabaseConfig {
  dbPath: string;
  journalMode: 'WAL' | 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'OFF';
  busyTimeout: number;
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  walAutocheckpoint: number;
  cacheSize: number;
  maxPoolSize: number;
  retryConfig: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterRange: [number, number];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  operationId: string;
  transactionId: string | null;
  connectionId: string;
  operationType: OperationType;
  sql?: string;
  params?: unknown[];
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY';
  error?: ErrorInfo;
  lockState: LockStateSnapshot;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorInfo {
  message: string;
  code: string;
  stack?: string;
  isLockError: boolean;
  lockType?: LockType;
}

export interface LockStateSnapshot {
  connectionId: string;
  lockType: LockType;
  walFileSize: number;
  checkpointProgress: number;
  pendingWrites: number;
  activeReaders: number;
}

export interface TransactionContext {
  id: string;
  connectionId: string;
  state: TransactionState;
  startTime: number;
  endTime?: number;
  operations: string[];
  isDirty: boolean;
  savepoints: string[];
}

export interface ReplayRecord {
  id: string;
  timestamp: number;
  logEntries: LogEntry[];
  databaseState: DatabaseStateSnapshot;
  systemInfo: SystemInfo;
  errorContext?: ErrorContext;
}

export interface DatabaseStateSnapshot {
  dbPath: string;
  journalMode: string;
  autoCommit: boolean;
  walCheckpoint: {
    busy: number;
    log: number;
    checkpointed: number;
  };
  pageSize: number;
  pageCount: number;
  freelistCount: number;
}

export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  pid: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface ErrorContext {
  error: ErrorInfo;
  operationIndex: number;
  affectedConnections: string[];
  timestamp: number;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  version: number;
  createdAt: number;
  expiresAt?: number;
  dependencyKeys: string[];
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
}

export interface OperationMetadata {
  id: string;
  name: string;
  isIdempotent: boolean;
  dependencyKeys: string[];
  writeKeys: string[];
  readKeys: string[];
}

export interface IdempotencyRecord {
  id: string;
  operationId: string;
  operationName: string;
  executedAt: number;
  executionResult: unknown;
  transactionId?: string;
  status: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'FAILED';
}

export interface StressTestConfig {
  concurrentConnections: number;
  operationsPerConnection: number;
  readWriteRatio: number;
  transactionProbability: number;
  minDelayMs: number;
  maxDelayMs: number;
  runtimeMs: number;
}

export interface StressTestResult {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  lockErrors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  totalDurationMs: number;
  operationsPerSecond: number;
  errors: Array<{
    timestamp: number;
    message: string;
    isLockError: boolean;
  }>;
}

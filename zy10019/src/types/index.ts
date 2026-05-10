import { EventEmitter } from 'eventemitter3';

export enum ConnectionState {
  IDLE = 'idle',
  ACQUIRED = 'acquired',
  IN_USE = 'in_use',
  VALIDATING = 'validating',
  DESTROYED = 'destroyed',
  ERROR = 'error',
  TIMED_OUT = 'timed_out'
}

export enum PoolState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  DEGRADED = 'degraded',
  OVERLOADED = 'overloaded',
  DRAINING = 'draining',
  STOPPED = 'stopped'
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export type DatabaseType = 'postgresql' | 'mysql' | 'mock';

export interface ConnectionConfig {
  type?: DatabaseType;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  options?: Record<string, unknown>;
}

export interface PoolConfig {
  name: string;
  connection: ConnectionConfig;
  min: number;
  max: number;
  acquireTimeout: number;
  idleTimeout: number;
  reapInterval: number;
  validationQuery?: string;
  testOnBorrow: boolean;
  testOnReturn: boolean;
  testWhileIdle: boolean;
}

export interface ConnectionInfo {
  id: string;
  state: ConnectionState;
  createdAt: number;
  lastUsedAt: number;
  acquiredAt?: number;
  useCount: number;
  totalDuration: number;
  lastError?: PoolError;
  borrowedBy?: string;
}

export interface PoolMetrics {
  totalConnections: number;
  availableConnections: number;
  borrowedConnections: number;
  pendingRequests: number;
  waitingCount: number;
  createdCount: number;
  destroyedCount: number;
  errorCount: number;
  timeoutCount: number;
  totalAcquireTime: number;
  totalUseTime: number;
  acquireCount: number;
  releaseCount: number;
}

export interface PoolError {
  code: string;
  message: string;
  timestamp: number;
  connectionId?: string;
  requestId?: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface IdempotencyKey {
  key: string;
  createdAt: number;
  expiresAt: number;
  result?: unknown;
  retryCount: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface EventRecord {
  id: string;
  timestamp: number;
  type: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  connectionId?: string;
  requestId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  duration?: number;
}

export interface PoolEventMap {
  'connection:created': (info: ConnectionInfo) => void;
  'connection:acquired': (info: ConnectionInfo, requestId: string) => void;
  'connection:released': (info: ConnectionInfo, duration: number) => void;
  'connection:destroyed': (info: ConnectionInfo, reason: string) => void;
  'connection:error': (info: ConnectionInfo, error: PoolError) => void;
  'connection:timeout': (info: ConnectionInfo) => void;
  'pool:state-change': (oldState: PoolState, newState: PoolState) => void;
  'pool:metrics-update': (metrics: PoolMetrics) => void;
  'pool:warning': (message: string, context: Record<string, unknown>) => void;
  'pool:error': (error: PoolError) => void;
  'request:timeout': (requestId: string, waitTime: number) => void;
  'request:queue:full': () => void;
  'circuit-breaker:tripped': () => void;
  'circuit-breaker:reset': () => void;
}

export interface PoolEventEmitter extends EventEmitter<PoolEventMap> {}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  version: number;
  source: 'database' | 'cache';
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: Set<string>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  successThreshold: number;
  timeout: number;
}

export interface ReplayConfig {
  maxRecords: number;
  retentionPeriod: number;
  storagePath: string;
  autoPersist: boolean;
}

export interface HealthCheckResult {
  healthy: boolean;
  state: PoolState;
  timestamp: number;
  metrics: PoolMetrics;
  errors: PoolError[];
  warnings: string[];
}

export interface ReportSection {
  title: string;
  level: number;
  content: string;
}

export interface PoolReport {
  title: string;
  generatedAt: number;
  period: {
    start: number;
    end: number;
  };
  summary: {
    totalRequests: number;
    errorRate: number;
    avgAcquireTime: number;
    peakConnections: number;
    averageConnections: number;
  };
  sections: ReportSection[];
}

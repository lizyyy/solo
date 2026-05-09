export { PoolManager } from './core/pool-manager';
export { PoolService, PoolServiceConfig, PoolServiceOptions } from './core/pool-service';
export { PoolConnection, ConnectionClient, MockConnectionClient } from './core/connection';
export { EventStore, ReplayOptions, ReplayResult } from './core/event-store';
export { CacheManager, CacheStrategy, CacheOperation, CacheOptions, CacheStats } from './core/cache-manager';
export { RetryStrategy, RetryResult, RetryContext, backoffStrategies } from './core/retry-strategy';
export { CircuitBreaker, CircuitBreakerStats, CircuitBreakerSnapshot } from './core/circuit-breaker';
export { IdempotencyManager, IdempotencyOptions, ExecuteOptions, ExecuteResult, idempotencyManager } from './core/idempotency-manager';
export { MarkdownReport, ReportOptions } from './reporting/markdown-report';
export { logger, PoolLogger, LoggerContext } from './utils/logger';
export { MetricsCollector, metricsCollector } from './utils/metrics';
export { 
  PoolException,
  ConnectionTimeoutException,
  PoolExhaustedException,
  ConnectionValidationException,
  CircuitBreakerOpenException,
  ConnectionDestroyedException,
  IdempotencyConflictException,
  createPoolError,
  formatError,
  generateErrorId
} from './utils/errors';
export { 
  getPoolConfig, 
  validatePoolConfig, 
  createEnvConfig,
  DEFAULT_POOL_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_REPLAY_CONFIG,
  DEFAULT_CACHE_CONFIG
} from './config';

export * from './types';

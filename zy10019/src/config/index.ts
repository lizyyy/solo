import { PoolConfig, RetryConfig, CircuitBreakerConfig, ReplayConfig, DatabaseType } from '../types';

export const DEFAULT_POOL_CONFIG: Partial<PoolConfig> = {
  min: 2,
  max: 10,
  acquireTimeout: 30000,
  idleTimeout: 60000,
  reapInterval: 30000,
  testOnBorrow: true,
  testOnReturn: false,
  testWhileIdle: true,
  validationQuery: 'SELECT 1'
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  retryableErrors: new Set([
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'ECONNRESET',
    'EPIPE',
    'PROTOCOL_CONNECTION_LOST',
    'ER_LOCK_DEADLOCK'
  ])
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 0.5,
  recoveryTimeout: 30000,
  successThreshold: 3,
  timeout: 5000
};

export const DEFAULT_REPLAY_CONFIG: ReplayConfig = {
  maxRecords: 10000,
  retentionPeriod: 86400000,
  storagePath: './data/events',
  autoPersist: true
};

export const DEFAULT_CACHE_CONFIG = {
  ttl: 60000,
  checkperiod: 60000,
  maxKeys: 1000,
  useClones: true,
  deleteOnExpire: true
};

export const getPoolConfig = (overrides: Partial<PoolConfig>): PoolConfig => {
  if (!overrides.name) {
    throw new Error('Pool name is required');
  }
  if (!overrides.connection) {
    throw new Error('Connection config is required');
  }
  return {
    ...DEFAULT_POOL_CONFIG,
    ...overrides,
    connection: { ...overrides.connection }
  } as PoolConfig;
};

export const validatePoolConfig = (config: PoolConfig): string[] => {
  const errors: string[] = [];
  
  if (config.min < 0) {
    errors.push('min connections must be >= 0');
  }
  
  if (config.max < 1) {
    errors.push('max connections must be >= 1');
  }
  
  if (config.min > config.max) {
    errors.push('min connections cannot exceed max connections');
  }
  
  if (config.acquireTimeout < 0) {
    errors.push('acquireTimeout must be >= 0');
  }
  
  if (config.idleTimeout < 0) {
    errors.push('idleTimeout must be >= 0');
  }
  
  if (config.reapInterval < 1000) {
    errors.push('reapInterval must be >= 1000ms');
  }
  
  return errors;
};

function parseDatabaseType(type: string | undefined): DatabaseType {
  if (!type) return 'mock';
  const lowerType = type.toLowerCase();
  if (lowerType === 'postgresql' || lowerType === 'postgres' || lowerType === 'pg') {
    return 'postgresql';
  }
  if (lowerType === 'mysql') {
    return 'mysql';
  }
  return 'mock';
}

export function createPoolConfigFromEnv(): PoolConfig {
  const dbType = parseDatabaseType(process.env.DB_TYPE);
  
  return {
    name: process.env.POOL_NAME || 'default-pool',
    connection: {
      type: dbType,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || (dbType === 'postgresql' ? '5432' : '3306'), 10),
      database: process.env.DB_NAME || 'test',
      user: process.env.DB_USER || 'test',
      password: process.env.DB_PASSWORD || 'test',
      options: {}
    },
    min: parseInt(process.env.POOL_MIN || '2', 10),
    max: parseInt(process.env.POOL_MAX || '10', 10),
    acquireTimeout: parseInt(process.env.POOL_ACQUIRE_TIMEOUT || '30000', 10),
    idleTimeout: parseInt(process.env.POOL_IDLE_TIMEOUT || '60000', 10),
    reapInterval: parseInt(process.env.POOL_REAP_INTERVAL || '30000', 10),
    validationQuery: process.env.DB_VALIDATION_QUERY || 'SELECT 1',
    testOnBorrow: process.env.POOL_TEST_ON_BORROW !== 'false',
    testOnReturn: process.env.POOL_TEST_ON_RETURN === 'true',
    testWhileIdle: process.env.POOL_TEST_WHILE_IDLE !== 'false'
  };
}

export function createEnvConfig(): { port: number; host: string; logLevel: string } {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info'
  };
}

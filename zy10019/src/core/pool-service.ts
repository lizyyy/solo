import { PoolManager } from './pool-manager';
import { PoolConnection } from './connection';
import { EventStore } from './event-store';
import { CacheManager } from './cache-manager';
import { RetryStrategy } from './retry-strategy';
import { CircuitBreaker } from './circuit-breaker';
import { IdempotencyManager } from './idempotency-manager';
import { MarkdownReport } from '../reporting/markdown-report';
import { 
  PoolConfig, 
  PoolState, 
  PoolMetrics, 
  ConnectionInfo,
  HealthCheckResult,
  EventRecord,
  ReplayConfig
} from '../types';
import { getPoolConfig, validatePoolConfig } from '../config';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface PoolServiceConfig {
  pool: Partial<PoolConfig>;
  replay?: Partial<ReplayConfig>;
  cacheStrategy?: 'read-through' | 'write-through' | 'write-behind' | 'cache-aside';
}

export interface PoolServiceOptions {
  enableEvents?: boolean;
  enableCache?: boolean;
  enableCircuitBreaker?: boolean;
  enableRetry?: boolean;
  enableIdempotency?: boolean;
}

export class PoolService {
  private poolManager: PoolManager;
  private eventStore: EventStore;
  private cacheManager?: CacheManager;
  private retryStrategy?: RetryStrategy;
  private circuitBreaker?: CircuitBreaker;
  private idempotencyManager?: IdempotencyManager;
  private initialized: boolean = false;
  private readonly config: PoolServiceConfig;
  private readonly options: PoolServiceOptions;
  private startTime: number = 0;

  constructor(config: PoolServiceConfig, options: PoolServiceOptions = {}) {
    this.config = config;
    this.options = {
      enableEvents: true,
      enableCache: true,
      enableCircuitBreaker: true,
      enableRetry: true,
      enableIdempotency: true,
      ...options
    };

    const poolConfig = getPoolConfig(config.pool);
    const validationErrors = validatePoolConfig(poolConfig);
    
    if (validationErrors.length > 0) {
      throw new Error(`Invalid pool config: ${validationErrors.join('; ')}`);
    }

    this.poolManager = new PoolManager(poolConfig);
    
    if (this.options.enableEvents) {
      this.eventStore = new EventStore(config.replay);
      this.setupEventListeners();
    } else {
      this.eventStore = new EventStore({ ...config.replay, autoPersist: false });
    }

    if (this.options.enableCache) {
      this.cacheManager = new CacheManager({
        strategy: config.cacheStrategy
      });
    }

    if (this.options.enableRetry) {
      this.retryStrategy = new RetryStrategy();
    }

    if (this.options.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(poolConfig.name);
    }

    if (this.options.enableIdempotency) {
      this.idempotencyManager = new IdempotencyManager();
    }
  }

  private setupEventListeners(): void {
    this.poolManager.on('connection:created', (info) => {
      this.eventStore.record({
        type: 'connection:created',
        level: 'info',
        connectionId: info.id,
        message: `Connection ${info.id} created`
      });
    });

    this.poolManager.on('connection:acquired', (info, requestId) => {
      this.eventStore.record({
        type: 'connection:acquired',
        level: 'debug',
        connectionId: info.id,
        requestId,
        message: `Connection ${info.id} acquired by ${requestId}`
      });
    });

    this.poolManager.on('connection:released', (info, duration) => {
      this.eventStore.record({
        type: 'connection:released',
        level: 'debug',
        connectionId: info.id,
        message: `Connection ${info.id} released after ${duration}ms`,
        duration
      });
    });

    this.poolManager.on('connection:destroyed', (info, reason) => {
      this.eventStore.record({
        type: 'connection:destroyed',
        level: 'warn',
        connectionId: info.id,
        message: `Connection ${info.id} destroyed: ${reason}`,
        metadata: { reason }
      });
    });

    this.poolManager.on('connection:error', (info, error) => {
      this.eventStore.record({
        type: 'connection:error',
        level: 'error',
        connectionId: info.id,
        message: `Connection error: ${error.message}`,
        metadata: { error: error.code }
      });
    });

    this.poolManager.on('connection:timeout', (info) => {
      this.eventStore.record({
        type: 'connection:timeout',
        level: 'error',
        connectionId: info.id,
        message: `Connection ${info.id} timed out`
      });
    });

    this.poolManager.on('pool:state-change', (oldState, newState) => {
      this.eventStore.record({
        type: 'pool:state-change',
        level: 'info',
        message: `Pool state changed: ${oldState} -> ${newState}`,
        metadata: { oldState, newState }
      });
    });

    this.poolManager.on('pool:error', (error) => {
      this.eventStore.record({
        type: 'pool:error',
        level: 'error',
        connectionId: error.connectionId,
        requestId: error.requestId,
        message: `Pool error: ${error.code} - ${error.message}`,
        metadata: error.context
      });
    });

    this.poolManager.on('request:timeout', (requestId, waitTime) => {
      this.eventStore.record({
        type: 'request:timeout',
        level: 'warn',
        requestId,
        message: `Request ${requestId} timed out after ${waitTime}ms`,
        duration: waitTime
      });
    });

    this.poolManager.on('request:queue:full', () => {
      this.eventStore.record({
        type: 'request:queue:full',
        level: 'error',
        message: 'Request queue is full'
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing pool service', { poolName: this.config.pool.name });
    
    await this.poolManager.initialize();
    this.startTime = Date.now();
    this.initialized = true;

    logger.info('Pool service initialized successfully');
  }

  async execute<T>(
    operation: (connection: PoolConnection) => Promise<T>,
    options?: {
      requestId?: string;
      idempotencyKey?: string;
      timeout?: number;
      retries?: number;
    }
  ): Promise<T> {
    if (!this.initialized) {
      throw new Error('Pool service not initialized');
    }

    const requestId = options?.requestId ?? `req_${Date.now()}`;

    if (options?.idempotencyKey && this.idempotencyManager) {
      const result = await this.idempotencyManager.execute<T>({
        key: options.idempotencyKey,
        requestId,
        operation: async () => {
          return await this.executeWithCircuitBreaker(operation, requestId, options);
        },
        options: {
          shouldRetryOnFailure: false,
          onConflict: 'wait'
        }
      });

      if (!result.success) {
        throw result.error!;
      }

      return result.result!;
    }

    return this.executeWithCircuitBreaker(operation, requestId, options);
  }

  private async executeWithCircuitBreaker<T>(
    operation: (connection: PoolConnection) => Promise<T>,
    requestId: string,
    options?: {
      timeout?: number;
      retries?: number;
    }
  ): Promise<T> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute<T>(
        () => this.executeWithRetry(operation, requestId, options),
        { timeout: options?.timeout }
      );
    }

    return this.executeWithRetry(operation, requestId, options);
  }

  private async executeWithRetry<T>(
    operation: (connection: PoolConnection) => Promise<T>,
    requestId: string,
    options?: {
      timeout?: number;
      retries?: number;
    }
  ): Promise<T> {
    if (this.retryStrategy) {
      return this.retryStrategy.execute<T>(
        () => this.poolManager.withConnection(operation, {
          requestId,
          timeout: options?.timeout
        }),
        {
          maxRetries: options?.retries,
          operationName: `pool-operation-${requestId}`
        }
      );
    }

    return this.poolManager.withConnection(operation, {
      requestId,
      timeout: options?.timeout
    });
  }

  async executeWithCache<T>(
    cacheKey: string,
    operation: () => Promise<T>,
    options?: {
      ttl?: number;
      forceRefresh?: boolean;
      strategy?: 'read-through' | 'cache-aside';
    }
  ): Promise<T> {
    if (!this.cacheManager) {
      return operation();
    }

    const strategy = options?.strategy ?? 'read-through';
    
    if (strategy === 'read-through') {
      return this.cacheManager.getOrLoad(
        cacheKey,
        operation,
        {
          strategy,
          ttl: options?.ttl,
          forceRefresh: options?.forceRefresh
        }
      );
    }

    const cached = this.cacheManager.get<T>(cacheKey);
    if (cached !== undefined && !options?.forceRefresh) {
      return cached;
    }

    const result = await operation();
    await this.cacheManager.set(cacheKey, result, {
      strategy,
      ttl: options?.ttl
    });

    return result;
  }

  getState(): PoolState {
    return this.poolManager.getState();
  }

  getMetrics(): PoolMetrics {
    return this.poolManager.getMetrics();
  }

  getConnectionInfos(): ConnectionInfo[] {
    return this.poolManager.getConnectionInfos();
  }

  getConnectionById(id: string): ConnectionInfo | undefined {
    return this.poolManager.getConnectionById(id);
  }

  healthCheck(): HealthCheckResult {
    return this.poolManager.healthCheck();
  }

  getEvents(
    options?: {
      startTime?: number;
      endTime?: number;
      types?: string[];
      levels?: EventRecord['level'][];
      limit?: number;
    }
  ): EventRecord[] {
    return this.eventStore.getEvents({
      startTime: options?.startTime,
      endTime: options?.endTime,
      eventTypes: options?.types,
      levels: options?.levels,
      limit: options?.limit
    });
  }

  getEventById(id: string): EventRecord | undefined {
    return this.eventStore.getEventById(id);
  }

  async replayEvents(
    handler: (event: EventRecord, index: number, total: number) => Promise<void> | void,
    options?: {
      startTime?: number;
      endTime?: number;
      types?: string[];
      levels?: EventRecord['level'][];
      limit?: number;
      speed?: number;
    }
  ) {
    return this.eventStore.replay(handler, {
      startTime: options?.startTime,
      endTime: options?.endTime,
      eventTypes: options?.types,
      levels: options?.levels,
      limit: options?.limit,
      speed: options?.speed
    });
  }

  generateReport(
    options?: {
      period?: { start: number; end: number };
      title?: string;
      includeEvents?: boolean;
      maxEvents?: number;
    }
  ): string {
    const now = Date.now();
    const period = options?.period ?? {
      start: this.startTime,
      end: now
    };

    const metrics = this.getMetrics();
    const health = this.healthCheck();
    const events = options?.includeEvents !== false 
      ? this.getEvents({ limit: options?.maxEvents ?? 50 })
      : [];

    const report = new MarkdownReport(options?.title);
    
    report.addSummary(metrics, period);
    report.addPerformanceAnalysis(metrics);
    report.addHealthCheck(health);
    
    if (options?.includeEvents !== false) {
      report.addEvents(events, options?.maxEvents ?? 50);
    }
    
    report.addRecommendations(metrics);

    return report.generate();
  }

  async saveReport(
    filePath: string,
    options?: {
      period?: { start: number; end: number };
      title?: string;
      includeEvents?: boolean;
      maxEvents?: number;
    }
  ): Promise<void> {
    const report = this.generateReport(options);
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await fs.promises.writeFile(filePath, report, 'utf-8');
    
    logger.info('Report saved', { path: filePath });
  }

  getCacheStats() {
    return this.cacheManager?.getStats();
  }

  getCircuitBreakerSnapshot() {
    return this.circuitBreaker?.getSnapshot();
  }

  getIdempotencyStats() {
    return this.idempotencyManager?.getStats();
  }

  invalidateCache(key: string): boolean {
    return this.cacheManager?.invalidate(key) ?? false;
  }

  invalidateCachePattern(pattern: string): number {
    return this.cacheManager?.invalidatePattern(pattern) ?? 0;
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker?.reset();
  }

  clearIdempotencyCache(): void {
    this.idempotencyManager?.clear();
  }

  async close(): Promise<void> {
    if (this.idempotencyManager) {
      this.idempotencyManager.stop();
    }

    if (this.cacheManager) {
      this.cacheManager.destroy();
    }

    await this.eventStore.destroy();
    await this.poolManager.close();
    
    this.initialized = false;
    logger.info('Pool service closed');
  }

  getConfig() {
    return {
      pool: this.poolManager.getConfig(),
      options: this.options
    };
  }

  getServiceStats() {
    return {
      initialized: this.initialized,
      uptime: Date.now() - this.startTime,
      state: this.getState(),
      metrics: this.getMetrics(),
      cacheStats: this.getCacheStats(),
      circuitBreaker: this.getCircuitBreakerSnapshot(),
      idempotencyStats: this.getIdempotencyStats()
    };
  }
}

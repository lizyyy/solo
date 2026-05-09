import NodeCache from 'node-cache';
import { CacheEntry } from '../types';
import { logger } from '../utils/logger';
import { DEFAULT_CACHE_CONFIG } from '../config';

export type CacheStrategy = 'read-through' | 'write-through' | 'write-behind' | 'cache-aside';

export interface CacheOperation<T> {
  key: string;
  operation: 'read' | 'write' | 'delete' | 'invalidate';
  value?: T;
  timestamp: number;
  version: number;
}

export interface CacheOptions {
  strategy: CacheStrategy;
  ttl?: number;
  version?: number;
  forceRefresh?: boolean;
  skipCache?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  deletes: number;
  operations: CacheOperation<unknown>[];
  hitRate: number;
}

export interface WriteOperation<T> {
  key: string;
  value: T;
  ttl?: number;
  queuedAt: number;
}

export class CacheManager {
  private cache: NodeCache;
  private strategy: CacheStrategy;
  private hits: number = 0;
  private misses: number = 0;
  private writes: number = 0;
  private deletes: number = 0;
  private operations: CacheOperation<unknown>[] = [];
  private maxOperations: number = 1000;
  private versions: Map<string, number> = new Map();
  private writeBehindQueue: WriteOperation<unknown>[] = [];
  private writeBehindTimer?: NodeJS.Timeout;
  private writeBehindInterval: number = 500;
  private isProcessingWriteBehind: boolean = false;

  constructor(options?: {
    strategy?: CacheStrategy;
    ttl?: number;
    checkperiod?: number;
    maxKeys?: number;
  }) {
    this.strategy = options?.strategy ?? 'cache-aside';
    
    this.cache = new NodeCache({
      stdTTL: options?.ttl ?? DEFAULT_CACHE_CONFIG.ttl / 1000,
      checkperiod: options?.checkperiod ?? DEFAULT_CACHE_CONFIG.checkperiod / 1000,
      maxKeys: options?.maxKeys ?? DEFAULT_CACHE_CONFIG.maxKeys,
      useClones: DEFAULT_CACHE_CONFIG.useClones,
      deleteOnExpire: DEFAULT_CACHE_CONFIG.deleteOnExpire
    });

    if (this.strategy === 'write-behind') {
      this.startWriteBehindProcessor();
    }

    logger.info('CacheManager initialized', {
      strategy: this.strategy,
      ttl: options?.ttl ?? DEFAULT_CACHE_CONFIG.ttl
    });
  }

  private startWriteBehindProcessor(): void {
    this.writeBehindTimer = setInterval(() => {
      this.processWriteBehind().catch(error => {
        logger.error('Error processing write-behind queue', error as Error);
      });
    }, this.writeBehindInterval);
  }

  private async processWriteBehind(): Promise<void> {
    if (this.isProcessingWriteBehind || this.writeBehindQueue.length === 0) {
      return;
    }

    this.isProcessingWriteBehind = true;
    
    try {
      const operations = [...this.writeBehindQueue];
      this.writeBehindQueue = [];

      for (const op of operations) {
        const entry: CacheEntry = {
          key: op.key,
          value: op.value,
          createdAt: Date.now(),
          expiresAt: op.ttl ? Date.now() + op.ttl : Number.MAX_SAFE_INTEGER,
          version: this.getNextVersion(op.key),
          source: 'database'
        };
        this.cache.set(op.key, entry, op.ttl ? op.ttl / 1000 : 0);
        this.recordOperation('write', op.key, op.value);
      }

      logger.debug(`Processed ${operations.length} write-behind operations`);
    } finally {
      this.isProcessingWriteBehind = false;
    }
  }

  private getNextVersion(key: string): number {
    const current = this.versions.get(key) ?? 0;
    const next = current + 1;
    this.versions.set(key, next);
    return next;
  }

  private recordOperation<T>(
    operation: CacheOperation<T>['operation'],
    key: string,
    value?: T
  ): void {
    const op: CacheOperation<unknown> = {
      key,
      operation,
      value,
      timestamp: Date.now(),
      version: this.versions.get(key) ?? 0
    };

    this.operations.push(op);
    
    if (this.operations.length > this.maxOperations) {
      this.operations.shift();
    }
  }

  get<T>(
    key: string,
    loader?: () => Promise<T>,
    options?: CacheOptions
  ): T | undefined {
    const actualOptions = {
      strategy: options?.strategy ?? this.strategy,
      ...options
    };

    if (actualOptions.skipCache) {
      return undefined;
    }

    const entry = this.cache.get<CacheEntry<T>>(key);
    
    if (entry && !actualOptions.forceRefresh) {
      this.hits++;
      this.recordOperation('read', key, entry.value);
      logger.debug('Cache hit', { key });
      return entry.value;
    }

    this.misses++;
    this.recordOperation('read', key, undefined);
    logger.debug('Cache miss', { key });
    return undefined;
  }

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const actualOptions = {
      strategy: options?.strategy ?? this.strategy,
      ...options
    };

    const cached = this.get<T>(key, loader, actualOptions);
    
    if (cached !== undefined) {
      return cached;
    }

    const value = await loader();
    
    if (actualOptions.strategy === 'read-through') {
      await this.set(key, value, {
        ...actualOptions,
        ttl: actualOptions.ttl ?? DEFAULT_CACHE_CONFIG.ttl
      });
    }

    return value;
  }

  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    const actualOptions = {
      strategy: options?.strategy ?? this.strategy,
      ...options
    };

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: actualOptions.ttl 
        ? Date.now() + actualOptions.ttl 
        : Number.MAX_SAFE_INTEGER,
      version: this.getNextVersion(key),
      source: 'cache'
    };

    if (actualOptions.strategy === 'write-behind') {
      this.writeBehindQueue.push({
        key,
        value,
        ttl: actualOptions.ttl,
        queuedAt: Date.now()
      });
      
      this.cache.set(key, entry, actualOptions.ttl ? actualOptions.ttl / 1000 : 0);
      this.writes++;
      return true;
    }

    if (actualOptions.strategy === 'write-through') {
      this.cache.set(key, entry, actualOptions.ttl ? actualOptions.ttl / 1000 : 0);
      this.writes++;
      this.recordOperation('write', key, value);
      logger.debug('Write-through cache update', { key });
      return true;
    }

    const result = this.cache.set(key, entry, actualOptions.ttl ? actualOptions.ttl / 1000 : 0);
    this.writes++;
    this.recordOperation('write', key, value);
    
    logger.debug('Cache set', { key, strategy: actualOptions.strategy });
    return result;
  }

  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    const result = this.cache.del(key);
    
    if (result) {
      this.deletes++;
      this.versions.delete(key);
      this.recordOperation('delete', key);
      logger.debug('Cache deleted', { key });
    }

    return result > 0;
  }

  invalidate(key: string): boolean {
    const result = this.cache.del(key);
    this.recordOperation('invalidate', key);
    logger.debug('Cache invalidated', { key });
    return result > 0;
  }

  invalidatePattern(pattern: string): number {
    const keys = this.cache.keys();
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.del(key);
        count++;
      }
    }

    logger.info('Invalidated cache pattern', { pattern, count });
    return count;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  getEntry<T>(key: string): CacheEntry<T> | undefined {
    return this.cache.get<CacheEntry<T>>(key);
  }

  getVersion(key: string): number {
    return this.versions.get(key) ?? 0;
  }

  keys(): string[] {
    return this.cache.keys();
  }

  clear(): void {
    this.cache.flushAll();
    this.versions.clear();
    this.hits = 0;
    this.misses = 0;
    this.writes = 0;
    this.deletes = 0;
    this.operations = [];
    this.writeBehindQueue = [];
    
    logger.info('Cache cleared');
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      deletes: this.deletes,
      operations: [...this.operations],
      hitRate: total > 0 ? this.hits / total : 0
    };
  }

  getStrategy(): CacheStrategy {
    return this.strategy;
  }

  setStrategy(strategy: CacheStrategy): void {
    this.strategy = strategy;
    
    if (strategy === 'write-behind' && !this.writeBehindTimer) {
      this.startWriteBehindProcessor();
    }
    
    logger.info('Cache strategy changed', { strategy });
  }

  destroy(): void {
    if (this.writeBehindTimer) {
      clearInterval(this.writeBehindTimer);
      this.writeBehindTimer = undefined;
    }
    this.cache.close();
  }

  getCacheStats(): NodeCache.Stats {
    return this.cache.getStats();
  }
}

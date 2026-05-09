import { v4 as uuidv4 } from 'uuid';
import { IdempotencyKey } from '../types';
import { logger } from '../utils/logger';
import { IdempotencyConflictException, PoolException } from '../utils/errors';

interface IdempotencyEntry {
  key: string;
  createdAt: number;
  expiresAt: number;
  result?: unknown;
  error?: Error;
  status: 'pending' | 'completed' | 'failed';
  attempt: number;
  requestId?: string;
}

export interface IdempotencyOptions {
  ttl?: number;
  maxAttempts?: number;
  shouldRetryOnFailure?: boolean;
  onConflict?: 'error' | 'wait' | 'reuse';
}

export interface ExecuteOptions<T> {
  key: string;
  operation: () => Promise<T>;
  options?: IdempotencyOptions;
  requestId?: string;
}

export interface ExecuteResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  fromCache: boolean;
  attempt: number;
  status: 'new' | 'reused' | 'waiting' | 'conflict';
}

export class IdempotencyManager {
  private entries: Map<string, IdempotencyEntry>;
  private defaultTTL: number;
  private defaultMaxAttempts: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(defaultTTL: number = 3600000) {
    this.entries = new Map();
    this.defaultTTL = defaultTTL;
    this.defaultMaxAttempts = 3;
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt < now && entry.status !== 'pending') {
        this.entries.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned ${cleanedCount} expired idempotency entries`);
    }
  }

  register(
    key: string,
    requestId?: string,
    options?: IdempotencyOptions
  ): IdempotencyEntry {
    const existing = this.entries.get(key);
    
    if (existing) {
      if (existing.status === 'pending') {
        const conflictStrategy = options?.onConflict ?? 'error';
        if (conflictStrategy === 'error') {
          throw new IdempotencyConflictException(key, existing.status, requestId);
        }
        return existing;
      }
      return existing;
    }

    const ttl = options?.ttl ?? this.defaultTTL;
    const now = Date.now();
    
    const entry: IdempotencyEntry = {
      key,
      createdAt: now,
      expiresAt: now + ttl,
      status: 'pending',
      attempt: 0,
      requestId
    };

    this.entries.set(key, entry);
    
    logger.debug('Registered idempotency key', {
      key,
      requestId,
      ttl
    });

    return entry;
  }

  complete<T>(key: string, result: T, requestId?: string): void {
    const entry = this.entries.get(key);
    
    if (!entry) {
      logger.warn('Attempting to complete non-existent idempotency entry', {
        key,
        requestId
      });
      return;
    }

    entry.status = 'completed';
    entry.result = result;
    entry.requestId = requestId;

    logger.debug('Completed idempotency operation', {
      key,
      requestId,
      attempt: entry.attempt
    });
  }

  fail(key: string, error: Error, requestId?: string): void {
    const entry = this.entries.get(key);
    
    if (!entry) {
      logger.warn('Attempting to fail non-existent idempotency entry', {
        key,
        requestId
      });
      return;
    }

    entry.status = 'failed';
    entry.error = error;
    entry.requestId = requestId;

    logger.warn('Idempotency operation failed', {
      key,
      requestId,
      error: error.message,
      attempt: entry.attempt
    });
  }

  retry(key: string, requestId?: string): boolean {
    const entry = this.entries.get(key);
    
    if (!entry) {
      return false;
    }

    const maxAttempts = this.defaultMaxAttempts;
    
    if (entry.attempt >= maxAttempts) {
      logger.warn('Max retries exceeded for idempotency key', {
        key,
        requestId,
        attempt: entry.attempt,
        maxAttempts
      });
      return false;
    }

    entry.attempt++;
    entry.status = 'pending';

    logger.info('Retrying idempotency operation', {
      key,
      requestId,
      attempt: entry.attempt,
      maxAttempts
    });

    return true;
  }

  get(key: string): IdempotencyKey | undefined {
    const entry = this.entries.get(key);
    
    if (!entry) {
      return undefined;
    }

    return {
      key: entry.key,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      result: entry.result,
      retryCount: entry.attempt,
      status: entry.status
    };
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  isCompleted(key: string): boolean {
    const entry = this.entries.get(key);
    return entry?.status === 'completed';
  }

  isFailed(key: string): boolean {
    const entry = this.entries.get(key);
    return entry?.status === 'failed';
  }

  async execute<T>(options: ExecuteOptions<T>): Promise<ExecuteResult<T>> {
    const { key, operation, options: opts, requestId } = options;
    const existing = this.entries.get(key);

    if (existing) {
      if (existing.status === 'completed') {
        logger.info('Reusing cached result for idempotency key', {
          key,
          requestId
        });
        
        return {
          success: true,
          result: existing.result as T,
          fromCache: true,
          attempt: existing.attempt,
          status: 'reused'
        };
      }

      if (existing.status === 'pending') {
        const conflictStrategy = opts?.onConflict ?? 'error';
        
        if (conflictStrategy === 'error') {
          throw new IdempotencyConflictException(key, existing.status, requestId);
        }
        
        if (conflictStrategy === 'wait') {
          return await this.waitForCompletion<T>(key, operation, requestId);
        }
      }
    }

    const entry = this.register(key, requestId, opts);

    try {
      entry.attempt++;
      const result = await operation();
      this.complete(key, result, requestId);
      
      return {
        success: true,
        result,
        fromCache: false,
        attempt: entry.attempt,
        status: 'new'
      };
    } catch (error) {
      const err = error as Error;
      
      const shouldRetry = opts?.shouldRetryOnFailure ?? false;
      if (shouldRetry && this.retry(key, requestId)) {
        return this.execute(options);
      }
      
      this.fail(key, err, requestId);
      
      return {
        success: false,
        error: err,
        fromCache: false,
        attempt: entry.attempt,
        status: 'new'
      };
    }
  }

  private async waitForCompletion<T>(
    key: string,
    operation: () => Promise<T>,
    requestId?: string,
    maxWait: number = 30000
  ): Promise<ExecuteResult<T>> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const entry = this.entries.get(key);
      
      if (!entry) {
        return this.execute<T>({ key, operation, requestId });
      }
      
      if (entry.status === 'completed') {
        return {
          success: true,
          result: entry.result as T,
          fromCache: true,
          attempt: entry.attempt,
          status: 'reused'
        };
      }
      
      if (entry.status === 'failed') {
        if (this.retry(key, requestId)) {
          return this.execute<T>({ key, operation, requestId });
        }
        throw entry.error!;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new PoolException(
      'Timeout waiting for idempotency operation',
      'IDEMPOTENCY_WAIT_TIMEOUT',
      undefined,
      requestId
    );
  }

  invalidate(key: string): boolean {
    const result = this.entries.delete(key);
    
    if (result) {
      logger.debug('Invalidated idempotency key', { key });
    }
    
    return result;
  }

  clear(): void {
    this.entries.clear();
    logger.info('Cleared all idempotency entries');
  }

  getStats(): {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    expired: number;
  } {
    const now = Date.now();
    let pending = 0;
    let completed = 0;
    let failed = 0;
    let expired = 0;

    for (const entry of this.entries.values()) {
      if (entry.expiresAt < now) {
        expired++;
      } else if (entry.status === 'pending') {
        pending++;
      } else if (entry.status === 'completed') {
        completed++;
      } else if (entry.status === 'failed') {
        failed++;
      }
    }

    return {
      total: this.entries.size,
      pending,
      completed,
      failed,
      expired
    };
  }
}

export const idempotencyManager = new IdempotencyManager();

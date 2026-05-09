import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { RedisService } from './redis.service';
import { randomUUID } from 'crypto';

export interface LockOptions {
  ttl?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface Lock {
  key: string;
  value: string;
  release: () => Promise<boolean>;
}

const LOCK_PREFIX = 'lock:';
const DEFAULT_LOCK_TTL = 30000;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = 100;

@Injectable()
export class DistributedLockService {
  constructor(
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
  ) {}

  async acquire(
    resource: string,
    options: LockOptions = {},
  ): Promise<Lock | null> {
    const {
      ttl = DEFAULT_LOCK_TTL,
      retryCount = DEFAULT_RETRY_COUNT,
      retryDelay = DEFAULT_RETRY_DELAY,
    } = options;

    const key = `${LOCK_PREFIX}${resource}`;
    const value = randomUUID();

    for (let i = 0; i <= retryCount; i++) {
      const result = await this.redisService.set(key, value, 'PX', ttl, 'NX');

      if (result === 'OK') {
        const lock: Lock = {
          key,
          value,
          release: async () => this.release(key, value),
        };
        return lock;
      }

      if (i < retryCount) {
        await this.sleep(retryDelay);
      }
    }

    return null;
  }

  async tryAcquire(resource: string, ttl: number = DEFAULT_LOCK_TTL): Promise<Lock | null> {
    return this.acquire(resource, { ttl, retryCount: 0 });
  }

  async release(key: string, value: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const client = this.redisService.getClient();
    const result = await client.eval(script, 1, key, value);
    return result === 1;
  }

  async executeWithLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const lock = await this.acquire(resource, options);

    if (!lock) {
      throw new Error(`无法获取锁: ${resource}`);
    }

    try {
      return await fn();
    } finally {
      await lock.release();
    }
  }

  async executeWithLockOrThrow<T>(
    resource: string,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const { ttl = DEFAULT_LOCK_TTL } = options;
    const lock = await this.tryAcquire(resource, ttl);

    if (!lock) {
      throw new Error(`资源被锁定: ${resource}，请稍后重试`);
    }

    try {
      return await fn();
    } finally {
      await lock.release();
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

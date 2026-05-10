import redisClient from '../utils/redis';
import config from '../config';
import logger from '../utils/logger';
import { DistributedLockOptions } from '@live-push/shared';

interface Lock {
  key: string;
  value: string;
  expiresAt: number;
}

class DistributedLockService {
  private readonly LOCK_PREFIX = 'lock:';

  private getLockKey(key: string): string {
    return `${this.LOCK_PREFIX}${key}`;
  }

  async acquire(options: DistributedLockOptions): Promise<Lock | null> {
    const { key, ttl, timeout = config.lock.timeout, retryCount = 5, retryDelay = 100 } = options;
    const lockKey = this.getLockKey(key);
    const redis = redisClient.getClient();
    const lockValue = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + ttl;

    const startTime = Date.now();
    let attempts = 0;

    while (attempts < retryCount && Date.now() - startTime < timeout) {
      const result = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
      
      if (result === 'OK') {
        logger.debug('Lock acquired', { key: lockKey, attempts });
        return { key: lockKey, value: lockValue, expiresAt };
      }

      attempts++;
      logger.debug('Lock acquisition attempt failed, retrying', { key: lockKey, attempts });
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    logger.warn('Lock acquisition timeout', { key: lockKey, attempts, timeout });
    return null;
  }

  async release(lock: Lock): Promise<boolean> {
    const redis = redisClient.getClient();
    
    const currentValue = await redis.get(lock.key);
    
    if (currentValue === lock.value) {
      await redis.del(lock.key);
      logger.debug('Lock released', { key: lock.key });
      return true;
    }

    logger.warn('Lock value mismatch on release', { key: lock.key });
    return false;
  }

  async isLocked(key: string): Promise<boolean> {
    const redis = redisClient.getClient();
    const lockKey = this.getLockKey(key);
    const value = await redis.get(lockKey);
    return value !== null;
  }

  async withLock<T>(
    options: DistributedLockOptions,
    fn: () => Promise<T>
  ): Promise<T> {
    const lock = await this.acquire(options);
    
    if (!lock) {
      throw new Error(`Failed to acquire lock: ${options.key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }

  async extend(lock: Lock, additionalTtl: number): Promise<Lock | null> {
    const redis = redisClient.getClient();
    
    const currentValue = await redis.get(lock.key);
    
    if (currentValue !== lock.value) {
      logger.warn('Lock extend failed: value mismatch', { key: lock.key });
      return null;
    }

    const newExpiresAt = Date.now() + additionalTtl;
    await redis.pexpire(lock.key, additionalTtl);
    
    logger.debug('Lock extended', { key: lock.key, additionalTtl });
    return { ...lock, expiresAt: newExpiresAt };
  }
}

export default new DistributedLockService();

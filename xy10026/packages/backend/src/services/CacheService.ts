import { Redis } from 'ioredis';
import redisClient from '../utils/redis';
import config from '../config';
import logger from '../utils/logger';

class CacheService {
  private redis: Redis;
  private readonly namespace: string;
  private readonly defaultTtl: number;

  constructor() {
    this.namespace = config.cache.namespace;
    this.defaultTtl = config.cache.ttl;
    this.redis = redisClient.getClient();
  }

  private getKey(key: string, namespace?: string): string {
    const ns = namespace || this.namespace;
    return `${ns}:${key}`;
  }

  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const cacheKey = this.getKey(key, namespace);
    
    try {
      const value = await this.redis.get(cacheKey);
      if (value) {
        logger.debug('Cache hit', { key: cacheKey });
        return JSON.parse(value) as T;
      }
      logger.debug('Cache miss', { key: cacheKey });
      return null;
    } catch (error) {
      logger.error('Cache get error', error as Error, { key: cacheKey });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number, namespace?: string): Promise<void> {
    const cacheKey = this.getKey(key, namespace);
    const actualTtl = ttl ?? this.defaultTtl;
    
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(cacheKey, actualTtl, serialized);
      logger.debug('Cache set', { key: cacheKey, ttl: actualTtl });
    } catch (error) {
      logger.error('Cache set error', error as Error, { key: cacheKey });
    }
  }

  async delete(key: string, namespace?: string): Promise<void> {
    const cacheKey = this.getKey(key, namespace);
    
    try {
      await this.redis.del(cacheKey);
      logger.debug('Cache deleted', { key: cacheKey });
    } catch (error) {
      logger.error('Cache delete error', error as Error, { key: cacheKey });
    }
  }

  async invalidatePattern(pattern: string, namespace?: string): Promise<void> {
    const ns = namespace || this.namespace;
    const scanPattern = `${ns}:${pattern}`;
    
    try {
      const keys = await this.redis.keys(scanPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug('Cache pattern invalidated', { pattern: scanPattern, count: keys.length });
      }
    } catch (error) {
      logger.error('Cache pattern invalidation error', error as Error, { pattern: scanPattern });
    }
  }

  async exists(key: string, namespace?: string): Promise<boolean> {
    const cacheKey = this.getKey(key, namespace);
    const result = await this.redis.exists(cacheKey);
    return result === 1;
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
    namespace?: string
  ): Promise<T> {
    const cached = await this.get<T>(key, namespace);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl, namespace);
    return value;
  }

  async setWithVersion<T>(
    key: string,
    value: T,
    version: number,
    ttl?: number,
    namespace?: string
  ): Promise<boolean> {
    const cacheKey = this.getKey(key, namespace);
    const versionKey = `${cacheKey}:version`;
    const actualTtl = ttl ?? this.defaultTtl;

    try {
      const result = await this.redis.watch(versionKey);
      const currentVersion = await this.redis.get(versionKey);

      if (currentVersion && parseInt(currentVersion, 10) >= version) {
        await this.redis.unwatch();
        logger.warn('Cache version conflict', { key: cacheKey, currentVersion, newVersion: version });
        return false;
      }

      const multi = this.redis.multi();
      multi.setex(cacheKey, actualTtl, JSON.stringify(value));
      multi.setex(versionKey, actualTtl, version.toString());
      
      const execResult = await multi.exec();
      if (!execResult) {
        logger.warn('Cache set with version aborted', { key: cacheKey });
        return false;
      }

      logger.debug('Cache set with version', { key: cacheKey, version });
      return true;
    } catch (error) {
      logger.error('Cache set with version error', error as Error, { key: cacheKey });
      return false;
    }
  }
}

export default new CacheService();

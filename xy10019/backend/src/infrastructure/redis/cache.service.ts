import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

const DEFAULT_TTL = 300;
const CACHE_KEY_SEPARATOR = ':';
const CACHE_TAG_PREFIX = '__tags__';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
  ) {}

  generateKey(namespace: string, ...parts: any[]): string {
    const validParts = parts
      .filter((p) => p !== undefined && p !== null)
      .map((p) => String(p));
    return [namespace, ...validParts].join(CACHE_KEY_SEPARATOR);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.redisService.get(key);
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(
    key: string,
    value: any,
    options: CacheOptions = {},
  ): Promise<void> {
    const { ttl = DEFAULT_TTL } = options;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await this.redisService.setex(key, ttl, serialized);
    } else {
      await this.redisService.set(key, serialized);
    }

    if (options.tags && options.tags.length > 0) {
      await this.associateTags(key, options.tags);
    }
  }

  async getOrSet<T = any>(
    key: string,
    supplier: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await supplier();
    await this.set(key, value, options);
    return value;
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.redisService.del(key);
    return result > 0;
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const client = this.redisService.getClient();
    const keys = await client.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    const result = await client.del(...keys);
    this.logger.log(`已删除 ${keys.length} 个缓存键`);
    return result;
  }

  async deleteByTags(...tags: string[]): Promise<number> {
    if (tags.length === 0) {
      return 0;
    }

    const client = this.redisService.getClient();
    let deletedCount = 0;

    for (const tag of tags) {
      const tagKey = `${CACHE_TAG_PREFIX}${tag}`;
      const keys = await client.smembers(tagKey);
      
      if (keys.length === 0) {
        continue;
      }

      for (const key of keys) {
        await this.redisService.del(key);
        deletedCount++;
      }

      await client.del(tagKey);
    }

    this.logger.log(`通过标签删除了 ${deletedCount} 个缓存键`);
    return deletedCount;
  }

  private async associateTags(key: string, tags: string[]): Promise<void> {
    const client = this.redisService.getClient();
    const multi = client.multi();

    for (const tag of tags) {
      multi.sadd(`${CACHE_TAG_PREFIX}${tag}`, key);
    }

    await multi.exec();
  }

  async invalidateInventory(storeId?: string, productId?: string): Promise<number> {
    const patterns: string[] = [];

    if (storeId && productId) {
      patterns.push(`inventory:${storeId}:${productId}*`);
    } else if (storeId) {
      patterns.push(`inventory:${storeId}:*`);
      patterns.push(`inventory:list:${storeId}*`);
    } else if (productId) {
      patterns.push(`inventory:*:${productId}*`);
    } else {
      patterns.push('inventory:*');
    }

    let total = 0;
    for (const pattern of patterns) {
      total += await this.deleteByPattern(pattern);
    }

    return total;
  }

  async invalidateStatistics(storeId?: string): Promise<number> {
    const patterns = storeId
      ? [`inventory:stats:${storeId}*`]
      : ['inventory:stats:*'];

    let total = 0;
    for (const pattern of patterns) {
      total += await this.deleteByPattern(pattern);
    }
    return total;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redisService.exists(key);
    return result > 0;
  }

  async getTtl(key: string): Promise<number> {
    return this.redisService.ttl(key);
  }

  async setTtl(key: string, ttl: number): Promise<boolean> {
    const result = await this.redisService.expire(key, ttl);
    return result === 1;
  }

  async flushAll(): Promise<void> {
    const client = this.redisService.getClient();
    await client.flushdb();
    this.logger.warn('已清空所有缓存');
  }

  async getCacheInfo(): Promise<{
    dbSize: number;
    patternStats: Record<string, number>;
  }> {
    const client = this.redisService.getClient();
    const dbSize = await client.dbsize();

    const patterns = [
      'inventory:*',
      'inventory:list:*',
      'inventory:stats:*',
      'audit:*',
      '__tags__:*',
    ];

    const patternStats: Record<string, number> = {};

    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      patternStats[pattern] = keys.length;
    }

    return {
      dbSize,
      patternStats,
    };
  }
}

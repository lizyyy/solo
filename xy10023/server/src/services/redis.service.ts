import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';

class RedisService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: this.buildRedisUrl(),
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max retries reached, giving up');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.setupEventHandlers();
  }

  private buildRedisUrl(): string {
    const { host, port, password, db } = config.redis;
    const auth = password ? `:${password}@` : '';
    return `redis://${auth}${host}:${port}/${db}`;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis: Connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis: Connected and ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis: Error', error);
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.warn('Redis: Connection closed');
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<string | null> {
    return this.client.set(key, value, options);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async acquireLock(
    key: string,
    owner: string,
    ttl: number = 30
  ): Promise<boolean> {
    const result = await this.client.set(`lock:${key}`, owner, {
      EX: ttl,
      NX: true,
    });
    return result === 'OK';
  }

  async releaseLock(key: string, owner: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const currentOwner = await this.client.get(lockKey);
    
    if (currentOwner === owner) {
      await this.client.del(lockKey);
      return true;
    }
    return false;
  }

  async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = 30,
    maxWait: number = 5000
  ): Promise<T> {
    const owner = `${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const acquired = await this.acquireLock(key, owner, ttl);
      if (acquired) {
        try {
          return await callback();
        } finally {
          await this.releaseLock(key, owner);
        }
      }
      await this.sleep(100);
    }

    throw new Error(`Failed to acquire lock for key: ${key} after ${maxWait}ms`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async setJSON(key: string, value: unknown, ttl?: number): Promise<void> {
    const jsonValue = JSON.stringify(value);
    if (ttl) {
      await this.client.set(key, jsonValue, { EX: ttl });
    } else {
      await this.client.set(key, jsonValue);
    }
  }

  async getJSON<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) return null;
    return JSON.parse(value) as T;
  }
}

export const redisService = new RedisService();
export default redisService;

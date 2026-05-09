import Redis from 'ioredis';
import config from '../config';
import logger from './logger';

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;

  connect(): Redis {
    if (this.client && this.isConnected) {
      return this.client;
    }

    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis reconnecting, attempt ${times}`, { delay });
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully', { host: config.redis.host, port: config.redis.port });
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      logger.error('Redis connection error', err);
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis reconnecting');
    });

    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  getClient(): Redis {
    if (!this.client) {
      return this.connect();
    }
    return this.client;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export default new RedisClient();

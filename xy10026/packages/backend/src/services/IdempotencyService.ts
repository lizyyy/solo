import redisClient from '../utils/redis';
import config from '../config';
import logger from '../utils/logger';
import { IdempotencyRecord } from '@live-push/shared';

class IdempotencyService {
  private readonly IDEMPOTENCY_PREFIX = 'idempotency:';
  private readonly defaultTtl: number;

  constructor() {
    this.defaultTtl = config.idempotency.ttl;
  }

  private getKey(idempotencyKey: string): string {
    return `${this.IDEMPOTENCY_PREFIX}${idempotencyKey}`;
  }

  async checkAndSet(
    idempotencyKey: string,
    traceId: string,
    messageId: string,
    response?: Record<string, unknown>
  ): Promise<IdempotencyRecord | null> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);

    const record: IdempotencyRecord = {
      idempotencyKey,
      traceId,
      messageId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.defaultTtl * 1000),
      response,
    };

    const serialized = JSON.stringify(record);
    const result = await redis.set(key, serialized, 'EX', this.defaultTtl, 'NX');

    if (result === 'OK') {
      logger.debug('Idempotency record created', { idempotencyKey, traceId, messageId });
      return null;
    }

    const existingRecord = await redis.get(key);
    if (existingRecord) {
      const parsed = JSON.parse(existingRecord) as IdempotencyRecord;
      logger.info('Idempotency key collision detected', { 
        idempotencyKey, 
        existingTraceId: parsed.traceId,
        newTraceId: traceId 
      });
      return parsed;
    }

    return null;
  }

  async get(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);

    const value = await redis.get(key);
    if (value) {
      return JSON.parse(value) as IdempotencyRecord;
    }
    return null;
  }

  async setResponse(idempotencyKey: string, response: Record<string, unknown>): Promise<boolean> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);

    const value = await redis.get(key);
    if (!value) {
      return false;
    }

    const record = JSON.parse(value) as IdempotencyRecord;
    record.response = response;

    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(record));
      logger.debug('Idempotency response stored', { idempotencyKey });
      return true;
    }

    return false;
  }

  async invalidate(idempotencyKey: string): Promise<void> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);

    await redis.del(key);
    logger.debug('Idempotency record invalidated', { idempotencyKey });
  }

  async exists(idempotencyKey: string): Promise<boolean> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);
    const result = await redis.exists(key);
    return result === 1;
  }
}

export default new IdempotencyService();

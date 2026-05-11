import redisClient from '../utils/redis';
import config from '../config';
import logger from '../utils/logger';
import { IdempotencyRecord, IdempotencyStatus } from '@live-push/shared';

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
    response?: Record<string, unknown>,
    status: IdempotencyStatus = 'pending'
  ): Promise<IdempotencyRecord | null> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);

    const record: IdempotencyRecord = {
      idempotencyKey,
      traceId,
      messageId,
      status,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.defaultTtl * 1000),
      response,
    };

    const serialized = JSON.stringify(record);
    const result = await redis.set(key, serialized, 'EX', this.defaultTtl, 'NX');

    if (result === 'OK') {
      logger.debug('Idempotency record created', { idempotencyKey, traceId, messageId, status });
      return null;
    }

    const existingRecord = await redis.get(key);
    if (existingRecord) {
      const parsed = JSON.parse(existingRecord) as IdempotencyRecord;
      logger.info('Idempotency key collision detected', { 
        idempotencyKey, 
        existingTraceId: parsed.traceId,
        newTraceId: traceId,
        status: parsed.status
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

  async setResponse(
    idempotencyKey: string, 
    response: Record<string, unknown>,
    messageId?: string
  ): Promise<boolean> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);

    const value = await redis.get(key);
    if (!value) {
      return false;
    }

    const record = JSON.parse(value) as IdempotencyRecord;
    record.response = response;
    record.status = 'completed';
    if (messageId) {
      record.messageId = messageId;
    }

    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(record));
      logger.debug('Idempotency response stored', { idempotencyKey, messageId: record.messageId });
      return true;
    }

    return false;
  }

  async setFailed(
    idempotencyKey: string,
    error: string,
    messageId?: string
  ): Promise<boolean> {
    const redis = redisClient.getClient();
    const key = this.getKey(idempotencyKey);

    const value = await redis.get(key);
    if (!value) {
      return false;
    }

    const record = JSON.parse(value) as IdempotencyRecord;
    record.status = 'failed';
    record.error = error;
    if (messageId) {
      record.messageId = messageId;
    }

    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(record));
      logger.debug('Idempotency marked as failed', { idempotencyKey, error });
      return true;
    }

    return false;
  }

  async waitForCompletion(
    idempotencyKey: string,
    maxWaitMs: number = 10000,
    pollIntervalMs: number = 500
  ): Promise<IdempotencyRecord | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const record = await this.get(idempotencyKey);
      
      if (!record) {
        return null;
      }
      
      if (record.status !== 'pending') {
        return record;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    return this.get(idempotencyKey);
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

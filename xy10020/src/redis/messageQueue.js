const { getRedisClient } = require('./client');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const QUEUE_PREFIX = 'live_push:queue:';
const PROCESSING_PREFIX = 'live_push:processing:';
const RETRY_PREFIX = 'live_push:retry:';
const IDEMPOTENCY_PREFIX = 'live_push:idempotency:';

const QUEUE_NAMES = {
  LIVE_ROOM_MESSAGES: 'live_room_messages',
  PUSH_TASKS: 'push_tasks',
  NOTIFICATIONS: 'notifications'
};

class MessageQueue {
  constructor() {
    this.redis = getRedisClient();
  }

  async enqueue(queueName, payload, options = {}) {
    const messageId = uuidv4();
    const message = {
      id: messageId,
      queue: queueName,
      payload,
      createdAt: Date.now(),
      priority: options.priority || 0,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      delay: options.delay || 0
    };

    if (options.delay > 0) {
      await this.redis.zadd(
        `${QUEUE_PREFIX}delayed:${queueName}`,
        Date.now() + options.delay,
        JSON.stringify(message)
      );
      logger.info(`消息已加入延迟队列: ${messageId}, 延迟: ${options.delay}ms`);
      return messageId;
    }

    const queueKey = `${QUEUE_PREFIX}${queueName}`;
    await this.redis.lpush(queueKey, JSON.stringify(message));
    logger.info(`消息已入队: ${messageId}, 队列: ${queueName}`);
    return messageId;
  }

  async dequeue(queueName, timeout = 0) {
    const queueKey = `${QUEUE_PREFIX}${queueName}`;
    const result = await this.redis.brpop(queueKey, timeout);

    if (!result) return null;

    const [, messageStr] = result;
    const message = JSON.parse(messageStr);

    const processingKey = `${PROCESSING_PREFIX}${queueName}:${message.id}`;
    await this.redis.setex(processingKey, 300, messageStr);

    logger.info(`消息已出队: ${message.id}, 队列: ${queueName}`);
    return message;
  }

  async ack(queueName, messageId) {
    const processingKey = `${PROCESSING_PREFIX}${queueName}:${messageId}`;
    await this.redis.del(processingKey);
    logger.info(`消息已确认: ${messageId}`);
  }

  async nack(queueName, message, error) {
    const messageId = message.id;
    const processingKey = `${PROCESSING_PREFIX}${queueName}:${messageId}`;
    await this.redis.del(processingKey);

    message.retryCount = (message.retryCount || 0) + 1;
    message.lastError = error?.message || String(error);
    message.lastRetryAt = Date.now();

    if (message.retryCount <= message.maxRetries) {
      const delay = Math.pow(2, message.retryCount) * 1000;
      await this.redis.zadd(
        `${QUEUE_PREFIX}delayed:${queueName}`,
        Date.now() + delay,
        JSON.stringify(message)
      );
      logger.warn(
        `消息重试: ${messageId}, 重试次数: ${message.retryCount}/${message.maxRetries}, 下次延迟: ${delay}ms`
      );
      return { retry: true };
    } else {
      const retryKey = `${RETRY_PREFIX}failed:${queueName}`;
      await this.redis.lpush(retryKey, JSON.stringify(message));
      logger.error(
        `消息重试次数耗尽已进入死信队列: ${messageId}, 错误: ${message.lastError}`
      );
      return { retry: false, deadLetter: true };
    }
  }

  async checkIdempotency(idempotencyKey, ttl = 3600) {
    if (!idempotencyKey) return { exists: false };

    const key = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
    const exists = await this.redis.get(key);

    if (exists) {
      return { exists: true, value: JSON.parse(exists) };
    }

    return { exists: false };
  }

  async setIdempotencyResult(idempotencyKey, result, ttl = 3600) {
    if (!idempotencyKey) return;

    const key = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
    await this.redis.setex(key, ttl, JSON.stringify(result));
  }

  async getQueueStats(queueName) {
    const queueKey = `${QUEUE_PREFIX}${queueName}`;
    const pendingCount = await this.redis.llen(queueKey);

    const delayedKey = `${QUEUE_PREFIX}delayed:${queueName}`;
    const delayedCount = await this.redis.zcard(delayedKey);

    const failedKey = `${RETRY_PREFIX}failed:${queueName}`;
    const failedCount = await this.redis.llen(failedKey);

    return {
      queueName,
      pending: pendingCount,
      delayed: delayedCount,
      failed: failedCount
    };
  }

  async processDelayedMessages() {
    const now = Date.now();

    for (const queueName of Object.values(QUEUE_NAMES)) {
      const delayedKey = `${QUEUE_PREFIX}delayed:${queueName}`;
      const messages = await this.redis.zrangebyscore(
        delayedKey,
        0,
        now,
        'LIMIT',
        0,
        100
      );

      for (const messageStr of messages) {
        const message = JSON.parse(messageStr);
        await this.redis.zrem(delayedKey, messageStr);
        await this.redis.lpush(`${QUEUE_PREFIX}${queueName}`, messageStr);
        logger.info(`延迟消息已移至主队列: ${message.id}`);
      }
    }
  }
}

const messageQueue = new MessageQueue();

module.exports = {
  messageQueue,
  QUEUE_NAMES
};

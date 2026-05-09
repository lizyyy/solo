const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redis = null;
let redisSubscriber = null;

const createRedisClient = () => {
  const client = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis连接失败次数过多，停止重试');
        return null;
      }
      return Math.min(times * 200, 2000);
    }
  });

  client.on('connect', () => {
    logger.info('Redis连接成功');
  });

  client.on('error', (err) => {
    logger.error('Redis连接错误:', err);
  });

  client.on('close', () => {
    logger.warn('Redis连接关闭');
  });

  return client;
};

const getRedisClient = () => {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
};

const getRedisSubscriber = () => {
  if (!redisSubscriber) {
    redisSubscriber = createRedisClient();
  }
  return redisSubscriber;
};

const closeRedis = async () => {
  if (redis) {
    await redis.quit();
    redis = null;
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
    redisSubscriber = null;
  }
};

module.exports = {
  getRedisClient,
  getRedisSubscriber,
  closeRedis
};

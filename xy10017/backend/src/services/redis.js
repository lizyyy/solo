const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

let client = null;

async function getClient() {
  if (client && client.isOpen) {
    return client;
  }
  
  client = createClient({
    url: config.redisUrl,
  });
  
  client.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });
  
  client.on('connect', () => {
    logger.info('Redis Client Connected');
  });
  
  client.on('reconnecting', () => {
    logger.warn('Redis Client Reconnecting...');
  });
  
  await client.connect();
  return client;
}

function getSyncClient() {
  return client;
}

async function ensureStream(streamName) {
  const redis = await getClient();
  try {
    await redis.xGroupCreate(streamName, config.consumerGroup, '0', 'MKSTREAM');
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) {
      throw err;
    }
  }
}

module.exports = {
  getClient,
  getSyncClient,
  ensureStream,
};

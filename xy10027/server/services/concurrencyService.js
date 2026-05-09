const { redis } = require('../config/redis');
const db = require('../config/database');
const logger = require('../utils/logger');

class ConcurrencyService {
  static LOCK_TIMEOUT = 30000;
  static REQUEST_CACHE_TTL = 86400000;

  static async acquireLock(resourceType, resourceId, userId, ttl = this.LOCK_TIMEOUT) {
    const lockKey = `lock:${resourceType}:${resourceId}`;
    const lockValue = `${userId}:${Date.now()}`;
    
    const result = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');
    
    if (result === 'OK') {
      logger.info(`Lock acquired for ${resourceType}:${resourceId} by user ${userId}`);
      return true;
    }
    
    const existingLock = await redis.get(lockKey);
    logger.warn(`Failed to acquire lock for ${resourceType}:${resourceId}. Lock held by: ${existingLock}`);
    return false;
  }

  static async releaseLock(resourceType, resourceId) {
    const lockKey = `lock:${resourceType}:${resourceId}`;
    await redis.del(lockKey);
    logger.info(`Lock released for ${resourceType}:${resourceId}`);
  }

  static async isLocked(resourceType, resourceId) {
    const lockKey = `lock:${resourceType}:${resourceId}`;
    const lockValue = await redis.get(lockKey);
    return lockValue !== null;
  }

  static async checkDuplicateRequest(requestId, userId) {
    const cacheKey = `request:${userId}:${requestId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      logger.warn(`Duplicate request detected: ${requestId} from user ${userId}`);
      return { isDuplicate: true, data: JSON.parse(cached) };
    }
    
    return { isDuplicate: false };
  }

  static async cacheRequestResult(requestId, userId, result) {
    const cacheKey = `request:${userId}:${requestId}`;
    await redis.set(cacheKey, JSON.stringify(result), 'PX', this.REQUEST_CACHE_TTL);
    logger.info(`Request result cached: ${requestId}`);
  }

  static async updateWithOptimisticLocking(
    tableName,
    id,
    updateData,
    expectedVersion,
    client = null
  ) {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(updateData).forEach((key) => {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(updateData[key]);
      paramIndex++;
    });
    
    setClauses.push(`version = version + 1`);
    
    const query = `
      UPDATE ${tableName}
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND version = $${paramIndex + 1}
      RETURNING *
    `;
    
    values.push(id, expectedVersion);
    
    const queryClient = client || db;
    const result = await queryClient.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Optimistic locking conflict: resource has been modified');
    }
    
    logger.info(`Optimistic update successful for ${tableName}:${id}`);
    return result.rows[0];
  }

  static async invalidateCache(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cache invalidated for pattern: ${pattern}, keys: ${keys.length}`);
    }
  }

  static async getFromCache(key) {
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  static async setInCache(key, value, ttl = 3600) {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
    logger.info(`Data cached: ${key}`);
  }
}

module.exports = ConcurrencyService;

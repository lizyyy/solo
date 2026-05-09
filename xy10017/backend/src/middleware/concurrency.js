const redis = require('../services/redis');
const { error: errorResponse } = require('../utils/response');
const { getLockKey } = require('../utils/idempotency');

const LOCK_TTL = 30;

function acquireLock(resourceId, ttl = LOCK_TTL) {
  const lockKey = getLockKey(resourceId);
  return redis.set(lockKey, 'locked', 'EX', ttl, 'NX');
}

function releaseLock(resourceId) {
  const lockKey = getLockKey(resourceId);
  return redis.del(lockKey);
}

function withLock(resourceIdParam = 'id', ttl = LOCK_TTL) {
  return async (req, res, next) => {
    const resourceId = req.params[resourceIdParam] || req.body[resourceIdParam];
    
    if (!resourceId) {
      return res.status(400).json(errorResponse('Resource ID required', 400));
    }
    
    const lockKey = getLockKey(resourceId);
    
    try {
      const lockAcquired = await redis.set(lockKey, 'locked', 'EX', ttl, 'NX');
      
      if (!lockAcquired) {
        return res.status(409).json(errorResponse('Resource is being modified by another user', 409));
      }
      
      res.releaseLock = async () => {
        await releaseLock(resourceId);
      };
      
      next();
    } catch (err) {
      await releaseLock(resourceId);
      next(err);
    }
  };
}

module.exports = {
  acquireLock,
  releaseLock,
  withLock,
};

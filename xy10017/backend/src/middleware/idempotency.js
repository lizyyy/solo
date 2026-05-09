const redis = require('../services/redis');
const { error: errorResponse } = require('../utils/response');

const IDEMPOTENCY_TTL = 86400;

function idempotency(keyPrefix = 'request') {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    
    if (!idempotencyKey) {
      return res.status(400).json(errorResponse('Idempotency key required', 400));
    }
    
    const cacheKey = `${keyPrefix}:${idempotencyKey}`;
    const lockKey = `${cacheKey}:lock`;
    
    try {
      const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 30, 'NX');
      
      if (!lockAcquired) {
        return res.status(409).json(errorResponse('Request is being processed', 409));
      }
      
      const existingResponse = await redis.get(cacheKey);
      if (existingResponse) {
        await redis.del(lockKey);
        const parsed = JSON.parse(existingResponse);
        return res.status(parsed.statusCode || 200).json(parsed.body);
      }
      
      res.sendResponse = async (statusCode, body) => {
        await redis.set(cacheKey, JSON.stringify({ statusCode, body }), 'EX', IDEMPOTENCY_TTL);
        await redis.del(lockKey);
        res.status(statusCode).json(body);
      };
      
      next();
    } catch (err) {
      await redis.del(lockKey);
      next(err);
    }
  };
}

module.exports = {
  idempotency,
};

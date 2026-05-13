const { v4: uuidv4 } = require('uuid');
const { checkIdempotency, storeIdempotency } = require('../utils/storage');
const config = require('../config/compatibility');

function idempotencyMiddleware(req, res, next) {
  const endpoint = req.path;
  
  if (!config.idempotentEndpoints.includes(endpoint)) {
    return next();
  }
  
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    const generatedKey = uuidv4();
    res.setHeader('X-Idempotency-Key', generatedKey);
    return next();
  }
  
  const idempotencyCheck = checkIdempotency(idempotencyKey);
  
  if (idempotencyCheck.exists) {
    res.setHeader('X-Idempotency-Hit', 'true');
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: '幂等请求，返回已缓存的结果',
      data: idempotencyCheck.result
    });
  }
  
  req.idempotencyKey = idempotencyKey;
  next();
}

function cacheIdempotentResult(key, result) {
  return storeIdempotency(key, result);
}

module.exports = {
  idempotencyMiddleware,
  cacheIdempotentResult
};

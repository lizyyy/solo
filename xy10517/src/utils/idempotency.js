const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database/connection');

function generateIdempotencyKey() {
  return uuidv4();
}

function hashRequest(request) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(request));
  return hash.digest('hex');
}

function checkIdempotency(idempotencyKey, request) {
  const db = getDB();
  const requestHash = hashRequest(request);
  
  const existing = db.prepare(`
    SELECT response FROM idempotency_keys 
    WHERE idempotency_key = ?
  `).get(idempotencyKey);
  
  if (existing) {
    return { isIdempotent: true, response: JSON.parse(existing.response) };
  }
  
  return { isIdempotent: false, requestHash };
}

function storeIdempotency(idempotencyKey, request, response) {
  const db = getDB();
  const requestHash = hashRequest(request);
  const responseStr = JSON.stringify(response);
  
  db.prepare(`
    INSERT INTO idempotency_keys (id, idempotency_key, request_hash, response)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), idempotencyKey, requestHash, responseStr);
}

function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }
  
  const { isIdempotent, response, requestHash } = checkIdempotency(
    idempotencyKey,
    { body: req.body, params: req.params, query: req.query }
  );
  
  if (isIdempotent) {
    return res.status(response.status || 200).json(response.body);
  }
  
  res._idempotencyData = { idempotencyKey, requestHash, request: req };
  
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res._responseBody = body;
    return originalJson(body);
  };
  
  res.on('finish', () => {
    if (res.statusCode < 400 && res._responseBody) {
      try {
        storeIdempotency(idempotencyKey, res._idempotencyData?.request || req, {
          status: res.statusCode,
          body: res._responseBody
        });
      } catch (e) {
        console.warn('存储幂等记录失败:', e.message);
      }
    }
  });
  
  next();
}

module.exports = {
  generateIdempotencyKey,
  checkIdempotency,
  storeIdempotency,
  idempotencyMiddleware
};

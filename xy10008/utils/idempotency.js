const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('./logger');

const IDEMPOTENCY_KEY_HEADER = 'X-Request-Id';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const checkIdempotency = (req, res, next) => {
  const requestId = req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] || req.body.requestId;
  
  if (!requestId) {
    return next();
  }
  
  const existing = db.prepare(`
    SELECT response FROM idempotency_keys WHERE request_id = ?
  `).get(requestId);
  
  if (existing) {
    logger.info('Idempotent request detected, returning cached response', { requestId });
    try {
      const cached = JSON.parse(existing.response);
      return res.status(cached.status || 200).json(cached.body);
    } catch (e) {
      logger.warn('Failed to parse cached idempotent response', { error: e.message });
    }
  }
  
  req.idempotencyKey = requestId;
  next();
};

const storeIdempotencyResponse = (req, responseData) => {
  if (!req.idempotencyKey) {
    return;
  }
  
  try {
    const now = Date.now();
    db.prepare(`
      INSERT OR REPLACE INTO idempotency_keys (id, request_id, response, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.idempotencyKey,
      JSON.stringify(responseData),
      now,
      now + IDEMPOTENCY_TTL_MS
    );
  } catch (error) {
    logger.error('Failed to store idempotency response', { error: error.message });
  }
};

const cleanupExpiredIdempotency = () => {
  try {
    const now = Date.now();
    const result = db.prepare(`
      DELETE FROM idempotency_keys WHERE expires_at < ?
    `).run(now);
    
    logger.info('Cleaned up expired idempotency keys', { count: result.changes });
  } catch (error) {
    logger.error('Failed to cleanup idempotency keys', { error: error.message });
  }
};

module.exports = {
  checkIdempotency,
  storeIdempotencyResponse,
  cleanupExpiredIdempotency,
  IDEMPOTENCY_KEY_HEADER
};

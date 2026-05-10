const crypto = require('crypto');
const { getDatabase } = require('../database/init');
const { generateId } = require('./idGenerator');

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function hashRequest(body) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(body || {}))
    .digest('hex');
}

function checkIdempotency(key, body) {
  const db = getDatabase();
  const requestHash = hashRequest(body);
  
  const existing = db.prepare(`
    SELECT response_data 
    FROM idempotency_keys 
    WHERE idempotency_key = ?
  `).get(key);

  if (existing) {
    return {
      exists: true,
      response: existing.response_data ? JSON.parse(existing.response_data) : null
    };
  }

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString();
  
  db.prepare(`
    INSERT INTO idempotency_keys (id, idempotency_key, request_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(generateId(), key, requestHash, expiresAt);

  return { exists: false };
}

function storeResponse(key, response) {
  const db = getDatabase();
  
  db.prepare(`
    UPDATE idempotency_keys 
    SET response_data = ?
    WHERE idempotency_key = ?
  `).run(JSON.stringify(response), key);
}

function cleanupExpired() {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const result = db.prepare(`
    DELETE FROM idempotency_keys 
    WHERE expires_at < ?
  `).run(now);

  return result.changes;
}

module.exports = {
  checkIdempotency,
  storeResponse,
  cleanupExpired,
  hashRequest
};

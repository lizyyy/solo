const { v4: uuidv4 } = require('uuid');

function generateIdempotencyKey() {
  return uuidv4();
}

function getKeyPrefix(userId) {
  return `idempotency:${userId}:`;
}

function getLockKey(resourceId) {
  return `lock:resource:${resourceId}`;
}

module.exports = {
  generateIdempotencyKey,
  getKeyPrefix,
  getLockKey,
};

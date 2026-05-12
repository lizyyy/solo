const db = require('../config/database');

function getIdempotentKey(requestKey) {
  const record = db.prepare('SELECT * FROM idempotency WHERE request_key = ?').get(requestKey);
  return record ? JSON.parse(record.response) : null;
}

function saveIdempotentKey(requestKey, response) {
  db.prepare(`
    INSERT INTO idempotency (id, request_key, response)
    VALUES (?, ?, ?)
  `).run(
    `idem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    requestKey,
    JSON.stringify(response)
  );
}

function withIdempotency(requestKey, handler) {
  const existing = getIdempotentKey(requestKey);
  if (existing) {
    return {
      isIdempotent: true,
      data: existing
    };
  }

  const result = handler();
  saveIdempotentKey(requestKey, result);

  return {
    isIdempotent: false,
    data: result
  };
}

module.exports = {
  getIdempotentKey,
  saveIdempotentKey,
  withIdempotency
};

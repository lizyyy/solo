const { getDb, saveDb } = require('../db');
const { now } = require('../utils');

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

const checkAndGet = (key, requestType) => {
  const db = getDb();
  
  const stmt = db.prepare('SELECT * FROM idempotency_keys WHERE key = ? AND request_type = ?');
  stmt.bind([key, requestType]);
  
  if (stmt.step()) {
    const record = stmt.getAsObject();
    stmt.reset();
    
    if (now() > record.expires_at) {
      db.run('DELETE FROM idempotency_keys WHERE key = ?', [key]);
      saveDb();
      return null;
    }
    return record.response ? JSON.parse(record.response) : null;
  }
  stmt.reset();

  return null;
};

const save = (key, requestType, responseData = null) => {
  const db = getDb();
  const timestamp = now();

  db.run(
    'INSERT OR REPLACE INTO idempotency_keys (key, request_type, response, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    [
      key,
      requestType,
      responseData ? JSON.stringify(responseData) : null,
      timestamp,
      timestamp + IDEMPOTENCY_TTL
    ]
  );
  saveDb();
};

const cleanup = () => {
  const db = getDb();
  db.run('DELETE FROM idempotency_keys WHERE expires_at < ?', [now()]);
  saveDb();
};

module.exports = {
  checkAndGet,
  save,
  cleanup
};

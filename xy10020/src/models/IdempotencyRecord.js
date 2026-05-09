const { getDb } = require('../database/client');

const DEFAULT_TTL = 3600 * 1000;

class IdempotencyRecord {
  static create(record) {
    const db = getDb();
    const now = Date.now();
    const expiresAt = now + (record.ttl || DEFAULT_TTL);

    const stmt = db.prepare(`
      INSERT INTO idempotency_records (
        idempotency_key, request_path, request_method,
        request_body, response_body, status_code,
        user_id, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        record.idempotencyKey,
        record.requestPath,
        record.requestMethod,
        record.requestBody ? JSON.stringify(record.requestBody) : null,
        record.responseBody ? JSON.stringify(record.responseBody) : null,
        record.statusCode || null,
        record.userId || null,
        now,
        expiresAt
      );
      return true;
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        return false;
      }
      throw err;
    }
  }

  static findByKey(idempotencyKey) {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      SELECT * FROM idempotency_records
      WHERE idempotency_key = ? AND expires_at > ?
    `);

    const row = stmt.get(idempotencyKey, now);
    if (!row) return null;

    return this.deserialize(row);
  }

  static cleanupExpired() {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      DELETE FROM idempotency_records
      WHERE expires_at <= ?
    `);

    const result = stmt.run(now);
    return result.changes;
  }

  static deserialize(row) {
    return {
      idempotencyKey: row.idempotency_key,
      requestPath: row.request_path,
      requestMethod: row.request_method,
      requestBody: row.request_body ? JSON.parse(row.request_body) : null,
      responseBody: row.response_body ? JSON.parse(row.response_body) : null,
      statusCode: row.status_code,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }
}

module.exports = IdempotencyRecord;

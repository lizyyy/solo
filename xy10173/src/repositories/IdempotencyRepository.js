const { getDb } = require('../config/database');
const { v4: uuid } = require('uuid');
const dayjs = require('dayjs');

class IdempotencyRepository {
  create(data) {
    const db = getDb();
    const now = dayjs().valueOf();
    const id = uuid();
    const stmt = db.prepare(`
      INSERT INTO idempotency_keys 
      (id, request_id, member_id, action, status, result, error_code, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.requestId, data.memberId, data.action,
      data.status, data.result ? JSON.stringify(data.result) : null,
      data.errorCode, data.errorMessage, now
    );
    return this.findById(id);
  }

  findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM idempotency_keys WHERE id = ?').get(id);
  }

  findByRequestIdAndAction(requestId, action) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM idempotency_keys 
      WHERE request_id = ? AND action = ?
    `).get(requestId, action);
  }

  update(id, data) {
    const db = getDb();
    const fields = [];
    const values = [];
    
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.result !== undefined) {
      fields.push('result = ?');
      values.push(JSON.stringify(data.result));
    }
    if (data.errorCode !== undefined) {
      fields.push('error_code = ?');
      values.push(data.errorCode);
    }
    if (data.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(data.errorMessage);
    }
    
    values.push(id);
    
    const stmt = db.prepare(`UPDATE idempotency_keys SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  }
}

module.exports = new IdempotencyRepository();

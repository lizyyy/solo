const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/client');

class OperationLog {
  static create(log) {
    const db = getDb();
    const now = Date.now();
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO operation_logs (
        id, operation_type, entity_type, entity_id, user_id,
        before_data, after_data, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      log.operationType,
      log.entityType || null,
      log.entityId || null,
      log.userId || null,
      log.beforeData ? JSON.stringify(log.beforeData) : null,
      log.afterData ? JSON.stringify(log.afterData) : null,
      log.ipAddress || null,
      log.userAgent || null,
      now
    );

    return id;
  }

  static findById(id) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM operation_logs WHERE id = ?
    `);

    const row = stmt.get(id);
    if (!row) return null;

    return this.deserialize(row);
  }

  static findByEntity(entityType, entityId, options = {}) {
    const db = getDb();
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    let sql = `
      SELECT * FROM operation_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = db.prepare(sql);
    const rows = stmt.all(entityType, entityId, limit, offset);

    return rows.map(row => this.deserialize(row));
  }

  static findByUserId(userId, options = {}) {
    const db = getDb();
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const stmt = db.prepare(`
      SELECT * FROM operation_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(userId, limit, offset);
    return rows.map(row => this.deserialize(row));
  }

  static findByTimeRange(startTime, endTime, options = {}) {
    const db = getDb();
    const limit = options.limit || 1000;
    const offset = options.offset || 0;

    const stmt = db.prepare(`
      SELECT * FROM operation_logs
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(startTime, endTime, limit, offset);
    return rows.map(row => this.deserialize(row));
  }

  static countByTimeRange(startTime, endTime) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM operation_logs
      WHERE created_at >= ? AND created_at <= ?
    `);

    const result = stmt.get(startTime, endTime);
    return result.count;
  }

  static deserialize(row) {
    return {
      id: row.id,
      operationType: row.operation_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      userId: row.user_id,
      beforeData: row.before_data ? JSON.parse(row.before_data) : null,
      afterData: row.after_data ? JSON.parse(row.after_data) : null,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    };
  }
}

module.exports = OperationLog;

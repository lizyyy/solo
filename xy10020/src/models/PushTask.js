const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/client');

class PushTask {
  static create(task) {
    const db = getDb();
    const now = Date.now();
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO push_tasks (
        id, task_type, live_room_id, target_user_ids, payload,
        status, retry_count, max_retries, scheduled_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      task.taskType,
      task.liveRoomId || null,
      task.targetUserIds ? JSON.stringify(task.targetUserIds) : null,
      JSON.stringify(task.payload),
      'pending',
      0,
      task.maxRetries || 3,
      task.scheduledAt || null,
      now,
      now
    );

    return this.findById(id);
  }

  static findById(id) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM push_tasks WHERE id = ?
    `);

    const row = stmt.get(id);
    if (!row) return null;

    return this.deserialize(row);
  }

  static findByStatus(status, options = {}) {
    const db = getDb();
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const stmt = db.prepare(`
      SELECT * FROM push_tasks
      WHERE status = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(status, limit, offset);
    return rows.map(row => this.deserialize(row));
  }

  static findByLiveRoom(liveRoomId, options = {}) {
    const db = getDb();
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const stmt = db.prepare(`
      SELECT * FROM push_tasks
      WHERE live_room_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(liveRoomId, limit, offset);
    return rows.map(row => this.deserialize(row));
  }

  static updateStatus(id, status, updates = {}) {
    const db = getDb();
    const now = Date.now();

    const fields = ['status = ?', 'updated_at = ?'];
    const values = [status, now, id];

    if (updates.retryCount !== undefined) {
      fields.push('retry_count = ?');
      values.splice(2, 0, updates.retryCount);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.splice(2, 0, updates.errorMessage);
    }
    if (updates.executedAt !== undefined) {
      fields.push('executed_at = ?');
      values.splice(2, 0, updates.executedAt);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.splice(2, 0, updates.completedAt);
    }

    const sql = `
      UPDATE push_tasks
      SET ${fields.join(', ')}
      WHERE id = ?
    `;

    db.prepare(sql).run(...values);
    return this.findById(id);
  }

  static incrementRetry(id, errorMessage) {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE push_tasks
      SET retry_count = retry_count + 1,
          error_message = ?,
          status = 'retrying',
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(errorMessage, now, id);
    return this.findById(id);
  }

  static countByStatus(status) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM push_tasks WHERE status = ?
    `);

    const result = stmt.get(status);
    return result.count;
  }

  static getStatistics() {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        MAX(created_at) as last_created
      FROM push_tasks
      GROUP BY status
    `);

    const rows = stmt.all();
    const stats = {};
    for (const row of rows) {
      stats[row.status] = {
        count: row.count,
        lastCreated: row.last_created
      };
    }
    return stats;
  }

  static deserialize(row) {
    return {
      id: row.id,
      taskType: row.task_type,
      liveRoomId: row.live_room_id,
      targetUserIds: row.target_user_ids ? JSON.parse(row.target_user_ids) : null,
      payload: JSON.parse(row.payload),
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      errorMessage: row.error_message,
      scheduledAt: row.scheduled_at,
      executedAt: row.executed_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = PushTask;

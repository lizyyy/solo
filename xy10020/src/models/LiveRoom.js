const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/client');
const logger = require('../utils/logger');

class LiveRoom {
  static create(room) {
    const db = getDb();
    const now = Date.now();
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO live_rooms (
        id, title, streamer_id, status, viewer_count,
        max_viewers, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      room.title,
      room.streamerId,
      room.status || 'offline',
      0,
      room.maxViewers || 0,
      1,
      now,
      now
    );

    return this.findById(id);
  }

  static findById(id) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM live_rooms WHERE id = ?
    `);

    const row = stmt.get(id);
    if (!row) return null;

    return this.deserialize(row);
  }

  static findByStreamerId(streamerId) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM live_rooms
      WHERE streamer_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(streamerId);
    return rows.map(row => this.deserialize(row));
  }

  static findActive() {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM live_rooms
      WHERE status = 'live'
      ORDER BY viewer_count DESC
    `);

    const rows = stmt.all();
    return rows.map(row => this.deserialize(row));
  }

  static updateWithOptimisticLock(id, updates, expectedVersion) {
    const db = getDb();
    const now = Date.now();

    const updateFields = [];
    const values = [];

    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.viewerCount !== undefined) {
      updateFields.push('viewer_count = ?');
      values.push(updates.viewerCount);
      if (updates.viewerCount > 0) {
        updateFields.push('max_viewers = MAX(max_viewers, ?)');
        values.push(updates.viewerCount);
      }
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push('version = version + 1');
    updateFields.push('updated_at = ?');
    values.push(now);

    values.push(id, expectedVersion);

    const sql = `
      UPDATE live_rooms
      SET ${updateFields.join(', ')}
      WHERE id = ? AND version = ?
    `;

    const result = db.prepare(sql).run(...values);

    if (result.changes === 0) {
      logger.warn(`乐观锁冲突: live_room ${id}, 期望版本 ${expectedVersion}`);
      return null;
    }

    return this.findById(id);
  }

  static incrementViewerCount(id, delta = 1) {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE live_rooms
      SET viewer_count = viewer_count + ?,
          max_viewers = MAX(max_viewers, viewer_count + ?),
          version = version + 1,
          updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(delta, delta, now, id);
    return result.changes > 0;
  }

  static delete(id) {
    const db = getDb();
    const stmt = db.prepare(`
      DELETE FROM live_rooms WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  static deserialize(row) {
    return {
      id: row.id,
      title: row.title,
      streamerId: row.streamer_id,
      status: row.status,
      viewerCount: row.viewer_count,
      maxViewers: row.max_viewers,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = LiveRoom;

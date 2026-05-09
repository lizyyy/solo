const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/client');

class UserConnection {
  static create(connection) {
    const db = getDb();
    const now = Date.now();
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO user_connections (
        id, user_id, live_room_id, connection_type, connected_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      connection.userId,
      connection.liveRoomId,
      connection.connectionType || 'websocket',
      now
    );

    return id;
  }

  static markDisconnected(id) {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE user_connections
      SET disconnected_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(now, id);
    return result.changes > 0;
  }

  static findActiveByLiveRoom(liveRoomId) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM user_connections
      WHERE live_room_id = ? AND disconnected_at IS NULL
      ORDER BY connected_at ASC
    `);

    const rows = stmt.all(liveRoomId);
    return rows.map(row => this.deserialize(row));
  }

  static countActiveByLiveRoom(liveRoomId) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM user_connections
      WHERE live_room_id = ? AND disconnected_at IS NULL
    `);

    const result = stmt.get(liveRoomId);
    return result.count;
  }

  static getActiveUsersByLiveRoom(liveRoomId) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT DISTINCT uc.user_id, u.username
      FROM user_connections uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.live_room_id = ? AND uc.disconnected_at IS NULL
    `);

    return stmt.all(liveRoomId);
  }

  static deserialize(row) {
    return {
      id: row.id,
      userId: row.user_id,
      liveRoomId: row.live_room_id,
      connectionType: row.connection_type,
      connectedAt: row.connected_at,
      disconnectedAt: row.disconnected_at
    };
  }
}

module.exports = UserConnection;

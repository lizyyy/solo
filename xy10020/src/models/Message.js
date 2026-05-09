const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/client');
const logger = require('../utils/logger');

class Message {
  static create(message) {
    const db = getDb();
    const now = Date.now();
    const id = uuidv4();

    const transaction = db.transaction((liveRoomId) => {
      const seqStmt = db.prepare(`
        SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq
        FROM messages
        WHERE live_room_id = ?
      `);
      const seqResult = seqStmt.get(liveRoomId);
      const sequenceNumber = seqResult.next_seq;

      const insertStmt = db.prepare(`
        INSERT INTO messages (
          id, live_room_id, sender_id, content, message_type,
          sequence_number, version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        id,
        message.liveRoomId,
        message.senderId,
        message.content,
        message.messageType || 'chat',
        sequenceNumber,
        1,
        now
      );

      return sequenceNumber;
    });

    const sequenceNumber = transaction(message.liveRoomId);

    return {
      id,
      sequenceNumber,
      createdAt: now
    };
  }

  static findById(id) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `);

    const row = stmt.get(id);
    if (!row) return null;

    return this.deserialize(row);
  }

  static findByLiveRoom(liveRoomId, options = {}) {
    const db = getDb();
    const limit = options.limit || 100;
    const sinceSequence = options.sinceSequence || 0;

    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE live_room_id = ? AND sequence_number > ?
      ORDER BY sequence_number ASC
      LIMIT ?
    `);

    const rows = stmt.all(liveRoomId, sinceSequence, limit);
    return rows.map(row => this.deserialize(row));
  }

  static findByLiveRoomReverse(liveRoomId, options = {}) {
    const db = getDb();
    const limit = options.limit || 100;

    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE live_room_id = ?
      ORDER BY sequence_number DESC
      LIMIT ?
    `);

    const rows = stmt.all(liveRoomId, limit);
    return rows.reverse().map(row => this.deserialize(row));
  }

  static countByLiveRoom(liveRoomId) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE live_room_id = ?
    `);

    const result = stmt.get(liveRoomId);
    return result.count;
  }

  static getMaxSequence(liveRoomId) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT COALESCE(MAX(sequence_number), 0) as max_seq
      FROM messages
      WHERE live_room_id = ?
    `);

    const result = stmt.get(liveRoomId);
    return result.max_seq;
  }

  static deserialize(row) {
    return {
      id: row.id,
      liveRoomId: row.live_room_id,
      senderId: row.sender_id,
      content: row.content,
      messageType: row.message_type,
      sequenceNumber: row.sequence_number,
      version: row.version,
      createdAt: row.created_at
    };
  }
}

module.exports = Message;

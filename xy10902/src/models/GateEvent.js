const { run, get, all } = require('../config/dbUtils');

class GateEvent {
  static async create(data) {
    try {
      const result = await run(
        `INSERT INTO gate_events 
         (event_id, plate_number, event_type, event_time, gate_id, direction, processed, deduplicated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.event_id,
          data.plate_number,
          data.event_type,
          data.event_time,
          data.gate_id || null,
          data.direction || null,
          0,
          0
        ]
      );
      return { success: true, id: result.lastID };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return { success: false, duplicate: true, message: '事件ID已存在' };
      }
      throw err;
    }
  }

  static async findByEventId(eventId) {
    return await get('SELECT * FROM gate_events WHERE event_id = ?', [eventId]);
  }

  static async findDeduplicates(plateNumber, eventTime, timeWindow = 300) {
    return await all(
      `SELECT * FROM gate_events 
       WHERE plate_number = ? 
         AND ABS(strftime('%s', event_time) - strftime('%s', ?)) < ?
         AND deduplicated = 0
       ORDER BY event_time`,
      [plateNumber, eventTime, timeWindow]
    );
  }

  static async markProcessed(id) {
    return await run('UPDATE gate_events SET processed = 1 WHERE id = ?', [id]);
  }

  static async markDeduplicated(id) {
    return await run('UPDATE gate_events SET deduplicated = 1 WHERE id = ?', [id]);
  }

  static async listByPlate(plateNumber, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return await all(
      `SELECT * FROM gate_events 
       WHERE plate_number = ? 
       ORDER BY event_time DESC LIMIT ? OFFSET ?`,
      [plateNumber, pageSize, offset]
    );
  }

  static async countByDateRange(startTime, endTime) {
    const result = await get(
      `SELECT COUNT(*) as count FROM gate_events 
       WHERE event_time >= ? AND event_time <= ?`,
      [startTime, endTime]
    );
    return result.count;
  }
}

module.exports = GateEvent;

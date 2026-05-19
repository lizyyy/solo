const { getDb } = require('../db/database');

class DeviceEvent {
  static async create(data, sessionId) {
    const db = getDb();
    const result = await db.run(`
      INSERT INTO device_events (
        session_id, device_id, event_type, event_time, station_id,
        cabinet_id, battery_id, error_code, error_message,
        severity, status, assignee, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      sessionId,
      data.deviceId,
      data.eventType,
      data.eventTime,
      data.stationId,
      data.cabinetId,
      data.batteryId,
      data.errorCode,
      data.errorMessage,
      data.severity,
      data.status || 'pending',
      data.assignee,
      JSON.stringify(data)
    );
    return result.lastID;
  }

  static async update(id, updates) {
    const db = getDb();
    const allowedFields = ['status', 'assignee', 'error_message', 'severity'];
    const setClauses = [];
    const values = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    
    if (setClauses.length === 0) return false;
    
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const result = await db.run(`
      UPDATE device_events
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `, ...values);
    return result.changes > 0;
  }

  static async getById(id) {
    const db = getDb();
    return await db.get('SELECT * FROM device_events WHERE id = ?', id);
  }

  static async filter(options = {}) {
    const db = getDb();
    let query = 'SELECT * FROM device_events WHERE 1=1';
    const params = [];

    if (options.assignee) {
      query += ' AND assignee = ?';
      params.push(options.assignee);
    }

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    if (options.eventType) {
      query += ' AND event_type = ?';
      params.push(options.eventType);
    }

    if (options.startTime) {
      query += ' AND event_time >= ?';
      params.push(options.startTime);
    }

    if (options.endTime) {
      query += ' AND event_time <= ?';
      params.push(options.endTime);
    }

    if (options.stationId) {
      query += ' AND station_id = ?';
      params.push(options.stationId);
    }

    query += ' ORDER BY event_time DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return await db.all(query, ...params);
  }

  static async getAll(limit = 100) {
    const db = getDb();
    return await db.all('SELECT * FROM device_events ORDER BY event_time DESC LIMIT ?', limit);
  }

  static async getSummary() {
    const db = getDb();
    return await db.all(`
      SELECT 
        status,
        COUNT(*) as count,
        event_type,
        COUNT(DISTINCT device_id) as device_count
      FROM device_events
      GROUP BY status, event_type
      ORDER BY count DESC
    `);
  }
}

module.exports = DeviceEvent;

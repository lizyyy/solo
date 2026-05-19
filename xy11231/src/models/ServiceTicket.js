const { getDb } = require('../db/database');

class ServiceTicket {
  static async create(data, sessionId) {
    const db = getDb();
    const result = await db.run(`
      INSERT INTO service_tickets (
        session_id, ticket_id, ticket_type, customer_id, customer_name,
        phone, station_id, device_id, issue_type, description,
        status, priority, assignee, created_time, resolved_time, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      sessionId,
      data.ticketId,
      data.ticketType,
      data.customerId,
      data.customerName,
      data.phone,
      data.stationId,
      data.deviceId,
      data.issueType,
      data.description,
      data.status || 'open',
      data.priority,
      data.assignee,
      data.createdTime,
      data.resolvedTime,
      JSON.stringify(data)
    );
    return result.lastID;
  }

  static async update(id, updates) {
    const db = getDb();
    const allowedFields = ['status', 'assignee', 'priority', 'description', 'resolved_time'];
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
      UPDATE service_tickets
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `, ...values);
    return result.changes > 0;
  }

  static async getById(id) {
    const db = getDb();
    return await db.get('SELECT * FROM service_tickets WHERE id = ?', id);
  }

  static async filter(options = {}) {
    const db = getDb();
    let query = 'SELECT * FROM service_tickets WHERE 1=1';
    const params = [];

    if (options.assignee) {
      query += ' AND assignee = ?';
      params.push(options.assignee);
    }

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    if (options.issueType) {
      query += ' AND issue_type = ?';
      params.push(options.issueType);
    }

    if (options.startTime) {
      query += ' AND created_time >= ?';
      params.push(options.startTime);
    }

    if (options.endTime) {
      query += ' AND created_time <= ?';
      params.push(options.endTime);
    }

    if (options.stationId) {
      query += ' AND station_id = ?';
      params.push(options.stationId);
    }

    if (options.priority) {
      query += ' AND priority = ?';
      params.push(options.priority);
    }

    query += ' ORDER BY created_time DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return await db.all(query, ...params);
  }

  static async getAll(limit = 100) {
    const db = getDb();
    return await db.all('SELECT * FROM service_tickets ORDER BY created_time DESC LIMIT ?', limit);
  }

  static async getSummary() {
    const db = getDb();
    return await db.all(`
      SELECT 
        status,
        COUNT(*) as count,
        issue_type,
        priority
      FROM service_tickets
      GROUP BY status, issue_type, priority
      ORDER BY count DESC
    `);
  }
}

module.exports = ServiceTicket;

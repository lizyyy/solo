const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class VisitorService {
  createApplication(data) {
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO visitor_applications (
        id, visitor_name, visitor_id_card, visitor_phone, visitor_company,
        visit_purpose, host_personnel_id, host_name, scheduled_start, scheduled_end,
        access_zones, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.visitor_name,
      data.visitor_id_card || null,
      data.visitor_phone || null,
      data.visitor_company || null,
      data.visit_purpose || null,
      data.host_personnel_id || null,
      data.host_name || null,
      data.scheduled_start,
      data.scheduled_end,
      data.access_zones || null,
      'pending'
    );

    return this.getApplicationById(id);
  }

  getApplicationById(id) {
    const stmt = db.prepare('SELECT * FROM visitor_applications WHERE id = ?');
    return stmt.get(id);
  }

  getApplications(filters = {}) {
    let sql = 'SELECT * FROM visitor_applications WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.host_personnel_id) {
      sql += ' AND host_personnel_id = ?';
      params.push(filters.host_personnel_id);
    }

    if (filters.visitor_name) {
      sql += ' AND visitor_name LIKE ?';
      params.push(`%${filters.visitor_name}%`);
    }

    if (filters.scheduled_date) {
      sql += ' AND DATE(scheduled_start) = ?';
      params.push(filters.scheduled_date);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50);
    params.push(filters.offset || 0);

    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  updateStatus(id, status, approvedBy) {
    const validStatuses = ['pending', 'approved', 'rejected', 'checked_in', 'checked_out', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('无效的状态');
    }

    const stmt = db.prepare(`
      UPDATE visitor_applications 
      SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(status, approvedBy || null, id);
    return this.getApplicationById(id);
  }

  checkIn(id, actualTime) {
    const stmt = db.prepare(`
      UPDATE visitor_applications 
      SET actual_start = ?, status = 'checked_in', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(actualTime || new Date().toISOString(), id);
    return this.getApplicationById(id);
  }

  checkOut(id, actualTime) {
    const stmt = db.prepare(`
      UPDATE visitor_applications 
      SET actual_end = ?, status = 'checked_out', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(actualTime || new Date().toISOString(), id);
    return this.getApplicationById(id);
  }
}

module.exports = new VisitorService();

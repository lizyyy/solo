const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');
const { STATUS_PENDING, STATUS_APPROVED, STATUS_RESTORED } = require('../models/NoFlyRecord');

class NoFlyRepository {
  async createRecord(data) {
    const id = uuidv4();
    const sql = `
      INSERT INTO no_fly_records 
      (id, route_id, drone_id, start_time, end_time, applicant_id, reason, status, cancel_older_tasks, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [
        id,
        data.route_id,
        data.drone_id || null,
        data.start_time,
        data.end_time,
        data.applicant_id,
        data.reason,
        data.status || STATUS_PENDING,
        data.cancel_older_tasks ? 1 : 0
      ], function(err) {
        if (err) reject(err);
        else resolve({ id, ...data });
      });
    });
  }

  async updateRecordStatus(id, status) {
    const sql = `
      UPDATE no_fly_records 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [status, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  async getById(id) {
    const sql = `
      SELECT 
        nfr.*,
        r.name as route_name,
        r.code as route_code,
        d.name as drone_name,
        d.code as drone_code,
        a.name as applicant_name,
        a.department as applicant_department
      FROM no_fly_records nfr
      LEFT JOIN routes r ON nfr.route_id = r.id
      LEFT JOIN drones d ON nfr.drone_id = d.id
      LEFT JOIN applicants a ON nfr.applicant_id = a.id
      WHERE nfr.id = ?
    `;
    
    return new Promise((resolve, reject) => {
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAll(filters = {}) {
    let sql = `
      SELECT 
        nfr.*,
        r.name as route_name,
        r.code as route_code,
        d.name as drone_name,
        d.code as drone_code,
        a.name as applicant_name,
        a.department as applicant_department
      FROM no_fly_records nfr
      LEFT JOIN routes r ON nfr.route_id = r.id
      LEFT JOIN drones d ON nfr.drone_id = d.id
      LEFT JOIN applicants a ON nfr.applicant_id = a.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.status) {
      sql += ' AND nfr.status = ?';
      params.push(filters.status);
    }
    
    if (filters.route_id) {
      sql += ' AND nfr.route_id = ?';
      params.push(filters.route_id);
    }
    
    if (filters.start_date) {
      sql += ' AND nfr.start_time >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      sql += ' AND nfr.end_time <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY nfr.created_at DESC';
    
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getActiveRecords(routeId) {
    const sql = `
      SELECT * FROM no_fly_records 
      WHERE route_id = ? AND status IN (?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      db.all(sql, [routeId, STATUS_PENDING, STATUS_APPROVED], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async addHistory(recordId, oldStatus, newStatus, operator, remark = '') {
    const id = uuidv4();
    const sql = `
      INSERT INTO no_fly_history (id, record_id, old_status, new_status, operator, remark, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [id, recordId, oldStatus, newStatus, operator, remark], function(err) {
        if (err) reject(err);
        else resolve({ id });
      });
    });
  }

  async getHistory(recordId) {
    const sql = `
      SELECT * FROM no_fly_history 
      WHERE record_id = ? 
      ORDER BY created_at ASC
    `;
    
    return new Promise((resolve, reject) => {
      db.all(sql, [recordId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async saveImportValidation(batchId, results) {
    const stmt = db.prepare(`
      INSERT INTO import_validation (id, batch_id, row_number, row_data, is_valid, errors, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        for (const result of results) {
          stmt.run(
            uuidv4(),
            batchId,
            result.rowNumber,
            JSON.stringify(result.rowData),
            result.isValid ? 1 : 0,
            JSON.stringify(result.errors)
          );
        }
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async getImportValidation(batchId) {
    const sql = `
      SELECT * FROM import_validation 
      WHERE batch_id = ? 
      ORDER BY row_number ASC
    `;
    
    return new Promise((resolve, reject) => {
      db.all(sql, [batchId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          row_data: JSON.parse(row.row_data),
          errors: JSON.parse(row.errors),
          is_valid: row.is_valid === 1
        })));
      });
    });
  }
}

module.exports = new NoFlyRepository();
const db = require('../db/database');
const dayjs = require('dayjs');

class BatchService {
  static create(data) {
    const batchNo = data.batch_no || `B${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO batches (batch_no, name, source, remark, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(batchNo, data.name, data.source || 'manual', data.remark || '', data.created_by || 'system');
    return this.getById(result.lastInsertRowid);
  }

  static getById(id) {
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
  }

  static getByNo(batchNo) {
    return db.prepare('SELECT * FROM batches WHERE batch_no = ?').get(batchNo);
  }

  static list(status) {
    let sql = 'SELECT * FROM batches ORDER BY created_at DESC';
    const params = [];
    if (status) {
      sql = 'SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC';
      params.push(status);
    }
    return db.prepare(sql).all(...params);
  }

  static getReturnBatches() {
    return db.prepare(`
      SELECT b.*, COUNT(p.id) as package_count
      FROM batches b
      LEFT JOIN packages p ON p.return_batch_id = b.id
      WHERE b.name LIKE '%退回%' OR b.batch_no LIKE 'RT%'
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all();
  }
}

module.exports = BatchService;

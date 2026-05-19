const { runQuery, getOne, getAll } = require('../database/connection');

class ImportBatch {
  static generateBatchNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BATCH${dateStr}${random}`;
  }

  static async create(data) {
    const now = new Date().toISOString();
    const batchNo = data.batchNo || this.generateBatchNo();
    
    const result = await runQuery(`
      INSERT INTO import_batches (
        batchNo, fileName, totalRecords, successRecords, failedRecords, status, importedBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batchNo,
      data.fileName,
      data.totalRecords || 0,
      data.successRecords || 0,
      data.failedRecords || 0,
      data.status || 'processing',
      data.importedBy,
      now
    ]);
    
    return { id: result.id, batchNo, ...data, createdAt: now };
  }

  static async findById(id) {
    return getOne('SELECT * FROM import_batches WHERE id = ?', [id]);
  }

  static async findByBatchNo(batchNo) {
    return getOne('SELECT * FROM import_batches WHERE batchNo = ?', [batchNo]);
  }

  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM import_batches WHERE 1=1';
    let params = [];
    
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.importedBy) {
      sql += ' AND importedBy = ?';
      params.push(filters.importedBy);
    }
    
    sql += ' ORDER BY createdAt DESC LIMIT 50';
    return getAll(sql, params);
  }

  static async update(id, data) {
    const updates = [];
    const params = [];
    
    if (data.totalRecords !== undefined) { updates.push('totalRecords = ?'); params.push(data.totalRecords); }
    if (data.successRecords !== undefined) { updates.push('successRecords = ?'); params.push(data.successRecords); }
    if (data.failedRecords !== undefined) { updates.push('failedRecords = ?'); params.push(data.failedRecords); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    
    params.push(id);
    
    await runQuery(`UPDATE import_batches SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
}

module.exports = ImportBatch;

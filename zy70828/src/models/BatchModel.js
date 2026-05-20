const { runAsync, getAsync, allAsync } = require('../utils/db');
const moment = require('moment');

class BatchModel {
  static generateBatchNo() {
    return 'BATCH-' + moment().format('YYYYMMDDHHmmss') + '-' + Math.floor(Math.random() * 1000);
  }

  static async create(batchData) {
    const batchNo = batchData.batch_no || this.generateBatchNo();
    const sql = `INSERT INTO batches 
      (batch_no, batch_type, total_count, processed_count, status, created_by) 
      VALUES (?, ?, ?, ?, ?, ?)`;
    const result = await runAsync(sql, [
      batchNo, batchData.batch_type, batchData.total_count || 0,
      0, 'processing', batchData.created_by
    ]);
    return { batchNo, id: result.lastID };
  }

  static async findByBatchNo(batchNo) {
    return getAsync('SELECT * FROM batches WHERE batch_no = ?', [batchNo]);
  }

  static async findById(id) {
    return getAsync('SELECT * FROM batches WHERE id = ?', [id]);
  }

  static async updateProgress(batchId, processedCount) {
    const sql = `UPDATE batches SET processed_count = ? WHERE id = ?`;
    return runAsync(sql, [processedCount, batchId]);
  }

  static async complete(batchId) {
    const sql = `UPDATE batches SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return runAsync(sql, [batchId]);
  }

  static async getAll() {
    return allAsync('SELECT * FROM batches ORDER BY created_at DESC');
  }

  static async getByStatus(status) {
    return allAsync('SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC', [status]);
  }
}

module.exports = BatchModel;

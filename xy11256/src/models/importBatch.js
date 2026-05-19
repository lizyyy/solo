const db = require('../utils/database');
const { v4: uuidv4 } = require('uuid');
const { IMPORT_STATUS, RECORD_STATUS } = require('../utils/constants');

class ImportBatchModel {
  async createBatch(importType, fileName) {
    const batchId = uuidv4();
    await db.run(`
      INSERT INTO import_batches (
        batch_id, import_type, file_name, status
      ) VALUES (?, ?, ?, ?)
    `, [batchId, importType, fileName, IMPORT_STATUS.PENDING]);
    
    return batchId;
  }

  async addRecord(batchId, rowNumber, rawData) {
    await db.run(`
      INSERT INTO import_records (
        batch_id, row_number, raw_data, status
      ) VALUES (?, ?, ?, ?)
    `, [batchId, rowNumber, JSON.stringify(rawData), RECORD_STATUS.PENDING]);
  }

  async addRecords(batchId, records) {
    for (const rec of records) {
      await db.run(`
        INSERT INTO import_records (batch_id, row_number, raw_data, status)
        VALUES (?, ?, ?, ?)
      `, [batchId, rec.rowNumber, JSON.stringify(rec.rawData), RECORD_STATUS.PENDING]);
    }
  }

  async updateRecordStatus(recordId, status, errorMessage = '', suggestion = '', hazardCode = null) {
    await db.run(`
      UPDATE import_records 
      SET status = ?, error_message = ?, suggestion = ?, hazard_code = ?
      WHERE id = ?
    `, [status, errorMessage, suggestion, hazardCode, recordId]);
  }

  async markRecordSuccess(recordId, hazardCode) {
    await this.updateRecordStatus(recordId, RECORD_STATUS.SUCCESS, '', '', hazardCode);
  }

  async markRecordFailed(recordId, errorMessage, suggestion = '') {
    await this.updateRecordStatus(recordId, RECORD_STATUS.FAILED, errorMessage, suggestion);
  }

  async markRecordSkipped(recordId, reason = '') {
    await this.updateRecordStatus(recordId, RECORD_STATUS.SKIPPED, reason);
  }

  async startBatch(batchId, totalCount) {
    await db.run(`
      UPDATE import_batches 
      SET status = ?, total_count = ?, started_at = CURRENT_TIMESTAMP 
      WHERE batch_id = ?
    `, [IMPORT_STATUS.PROCESSING, totalCount, batchId]);
  }

  async completeBatch(batchId) {
    const stats = await this.getBatchStats(batchId);
    
    let status = IMPORT_STATUS.SUCCESS;
    if (stats.failed > 0 && stats.success > 0) {
      status = IMPORT_STATUS.PARTIAL;
    } else if (stats.failed > 0 && stats.success === 0) {
      status = IMPORT_STATUS.FAILED;
    }

    await db.run(`
      UPDATE import_batches 
      SET status = ?, success_count = ?, failed_count = ?, 
          skipped_count = ?, completed_at = CURRENT_TIMESTAMP
      WHERE batch_id = ?
    `, [status, stats.success, stats.failed, stats.skipped, batchId]);

    return { batchId, status, ...stats };
  }

  async getBatchStats(batchId) {
    const records = await db.all(`
      SELECT status, COUNT(*) as count 
      FROM import_records 
      WHERE batch_id = ? 
      GROUP BY status
    `, [batchId]);

    const stats = { success: 0, failed: 0, skipped: 0, pending: 0 };
    records.forEach(r => {
      stats[r.status] = r.count;
    });

    return stats;
  }

  async getBatch(batchId) {
    return await db.get('SELECT * FROM import_batches WHERE batch_id = ?', [batchId]);
  }

  async getFailedRecords(batchId) {
    return await db.all(`
      SELECT * FROM import_records 
      WHERE batch_id = ? AND status = ?
      ORDER BY row_number ASC
    `, [batchId, RECORD_STATUS.FAILED]);
  }

  async getPendingRecords(batchId, limit = 100) {
    return await db.all(`
      SELECT * FROM import_records 
      WHERE batch_id = ? AND status = ?
      ORDER BY row_number ASC
      LIMIT ?
    `, [batchId, RECORD_STATUS.PENDING, limit]);
  }

  async retryFailedRecords(batchId) {
    await db.run(`
      UPDATE import_records 
      SET status = ?, error_message = '', suggestion = ''
      WHERE batch_id = ? AND status = ?
    `, [RECORD_STATUS.PENDING, batchId, RECORD_STATUS.FAILED]);

    return await this.getPendingRecords(batchId);
  }

  async listBatches(limit = 50) {
    return await db.all(`
      SELECT * FROM import_batches 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [limit]);
  }
}

module.exports = new ImportBatchModel();

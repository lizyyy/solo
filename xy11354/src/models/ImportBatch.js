const { run, get, all } = require('../config/database');
const logger = require('../config/logger');

class ImportBatch {
  static async create(batchType, fileName, createdBy = 'system') {
    try {
      const result = await run(
        'INSERT INTO import_batches (batch_type, file_name, created_by) VALUES (?, ?, ?)',
        [batchType, fileName, createdBy]
      );
      
      return { id: result.lastID, success: true };
    } catch (error) {
      logger.error('Create import batch failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async updateProgress(id, totalCount, successCount, failCount) {
    try {
      const result = await run(
        `UPDATE import_batches 
        SET total_count = ?, success_count = ?, fail_count = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [totalCount, successCount, failCount, id]
      );
      
      return result.changes > 0;
    } catch (error) {
      logger.error('Update batch progress failed:', error);
      return false;
    }
  }

  static async complete(id, status = 'completed', errorMessage = null) {
    try {
      const result = await run(
        `UPDATE import_batches 
        SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [status, errorMessage, id]
      );
      
      return result.changes > 0;
    } catch (error) {
      logger.error('Complete batch failed:', error);
      return false;
    }
  }

  static async findById(id) {
    try {
      return await get('SELECT * FROM import_batches WHERE id = ?', [id]);
    } catch (error) {
      logger.error('Find batch by id failed:', error);
      return null;
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM import_batches WHERE 1=1';
      const params = [];
      
      if (filters.batchType) {
        query += ' AND batch_type = ?';
        params.push(filters.batchType);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      return await all(query, params);
    } catch (error) {
      logger.error('Find all batches failed:', error);
      return [];
    }
  }
}

module.exports = ImportBatch;

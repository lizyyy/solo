const { run, get, all } = require('../config/database');
const logger = require('../config/logger');

class TemporaryPlate {
  static async create(data, batchId = null) {
    try {
      const result = await run(
        `INSERT INTO temporary_plates 
        (batch_id, plate_number, vehicle_type, owner_name, owner_phone, 
         valid_start_date, valid_end_date, issue_reason, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          data.plateNumber || data.plate_number,
          data.vehicleType || data.vehicle_type,
          data.ownerName || data.owner_name,
          data.ownerPhone || data.owner_phone,
          data.validStartDate || data.valid_start_date,
          data.validEndDate || data.valid_end_date,
          data.issueReason || data.issue_reason,
          'active'
        ]
      );
      
      return { id: result.lastID, success: true };
    } catch (error) {
      logger.error('Create temporary plate failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async bulkCreate(plates, batchId = null) {
    const results = { success: [], failed: [] };
    
    for (let i = 0; i < plates.length; i++) {
      const result = await this.create(plates[i], batchId);
      if (result.success) {
        results.success.push({ index: i, id: result.id });
      } else {
        results.failed.push({ index: i, error: result.error, data: plates[i] });
      }
    }
    
    return results;
  }

  static async findById(id) {
    try {
      return await get('SELECT * FROM temporary_plates WHERE id = ?', [id]);
    } catch (error) {
      logger.error('Find plate by id failed:', error);
      return null;
    }
  }

  static async findByPlateNumber(plateNumber) {
    try {
      return await get('SELECT * FROM temporary_plates WHERE plate_number = ?', [plateNumber]);
    } catch (error) {
      logger.error('Find plate by number failed:', error);
      return null;
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM temporary_plates WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.reviewStatus) {
        query += ' AND review_status = ?';
        params.push(filters.reviewStatus);
      }
      if (filters.validDate) {
        query += ' AND valid_start_date <= ? AND valid_end_date >= ?';
        params.push(filters.validDate, filters.validDate);
      }
      
      query += ' ORDER BY created_at DESC';
      
      return await all(query, params);
    } catch (error) {
      logger.error('Find all plates failed:', error);
      return [];
    }
  }

  static async review(id, status, remark, reviewer = 'system') {
    try {
      const result = await run(
        `UPDATE temporary_plates 
        SET review_status = ?, review_remark = ?, review_by = ?, review_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [status, remark, reviewer, id]
      );
      
      return result.changes > 0;
    } catch (error) {
      logger.error('Review plate failed:', error);
      return false;
    }
  }

  static async updateBlacklistStatus(id, isBlacklisted) {
    try {
      const result = await run(
        'UPDATE temporary_plates SET is_blacklisted = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [isBlacklisted ? 1 : 0, id]
      );
      return result.changes > 0;
    } catch (error) {
      logger.error('Update plate blacklist status failed:', error);
      return false;
    }
  }

  static async updateStatus(id, status) {
    try {
      const result = await run(
        'UPDATE temporary_plates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      );
      return result.changes > 0;
    } catch (error) {
      logger.error('Update plate status failed:', error);
      return false;
    }
  }

  static async delete(id) {
    try {
      const result = await run('DELETE FROM temporary_plates WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      logger.error('Delete plate failed:', error);
      return false;
    }
  }
}

module.exports = TemporaryPlate;

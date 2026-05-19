const { run, get, all } = require('../config/database');
const logger = require('../config/logger');

class Visitor {
  static async create(data, batchId = null) {
    try {
      const result = await run(
        `INSERT INTO visitors 
        (batch_id, visitor_name, phone, id_card, company, visit_reason, visit_date, 
         visit_time_start, visit_time_end, visited_person, license_plate, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          data.visitorName || data.visitor_name || data.name,
          data.phone || data.phoneNumber,
          data.idCard || data.id_card,
          data.company,
          data.visitReason || data.visit_reason,
          data.visitDate || data.visit_date,
          data.visitTimeStart || data.visit_time_start,
          data.visitTimeEnd || data.visit_time_end,
          data.visitedPerson || data.visited_person,
          data.licensePlate || data.license_plate,
          'pending'
        ]
      );
      
      return { id: result.lastID, success: true };
    } catch (error) {
      logger.error('Create visitor failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async bulkCreate(visitors, batchId = null) {
    const results = { success: [], failed: [] };
    
    for (let i = 0; i < visitors.length; i++) {
      const result = await this.create(visitors[i], batchId);
      if (result.success) {
        results.success.push({ index: i, id: result.id });
      } else {
        results.failed.push({ index: i, error: result.error, data: visitors[i] });
      }
    }
    
    return results;
  }

  static async findById(id) {
    try {
      return await get('SELECT * FROM visitors WHERE id = ?', [id]);
    } catch (error) {
      logger.error('Find visitor by id failed:', error);
      return null;
    }
  }

  static async findByPhone(phone) {
    try {
      return await all('SELECT * FROM visitors WHERE phone = ? ORDER BY created_at DESC', [phone]);
    } catch (error) {
      logger.error('Find visitor by phone failed:', error);
      return [];
    }
  }

  static async findByLicensePlate(plate) {
    try {
      return await all('SELECT * FROM visitors WHERE license_plate = ? ORDER BY created_at DESC', [plate]);
    } catch (error) {
      logger.error('Find visitor by plate failed:', error);
      return [];
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM visitors WHERE 1=1';
      const params = [];
      
      if (filters.visitDate) {
        query += ' AND visit_date = ?';
        params.push(filters.visitDate);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.reviewStatus) {
        query += ' AND review_status = ?';
        params.push(filters.reviewStatus);
      }
      if (filters.isBlacklisted !== undefined) {
        query += ' AND is_blacklisted = ?';
        params.push(filters.isBlacklisted ? 1 : 0);
      }
      
      query += ' ORDER BY created_at DESC';
      
      return await all(query, params);
    } catch (error) {
      logger.error('Find all visitors failed:', error);
      return [];
    }
  }

  static async review(id, status, remark, reviewer = 'system') {
    try {
      const result = await run(
        `UPDATE visitors 
        SET review_status = ?, review_remark = ?, review_by = ?, review_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [status, remark, reviewer, id]
      );
      
      return result.changes > 0;
    } catch (error) {
      logger.error('Review visitor failed:', error);
      return false;
    }
  }

  static async updateBlacklistStatus(id, isBlacklisted) {
    try {
      const result = await run(
        'UPDATE visitors SET is_blacklisted = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [isBlacklisted ? 1 : 0, id]
      );
      return result.changes > 0;
    } catch (error) {
      logger.error('Update visitor blacklist status failed:', error);
      return false;
    }
  }

  static async delete(id) {
    try {
      const result = await run('DELETE FROM visitors WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      logger.error('Delete visitor failed:', error);
      return false;
    }
  }
}

module.exports = Visitor;

const { run, get, all } = require('../config/database');
const logger = require('../config/logger');

class VerifyRecord {
  static async create(data) {
    try {
      const result = await run(
        `INSERT INTO verify_records 
        (verify_type, target_value, visitor_id, plate_id, blacklist_id, 
         is_allowed, is_in_blacklist, verify_result, verify_by, gate_number, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.verifyType || data.verify_type,
          data.targetValue || data.target_value,
          data.visitorId || data.visitor_id,
          data.plateId || data.plate_id,
          data.blacklistId || data.blacklist_id,
          data.isAllowed ? 1 : 0,
          data.isInBlacklist ? 1 : 0,
          data.verifyResult || data.verify_result,
          data.verifyBy || data.verify_by || 'system',
          data.gateNumber || data.gate_number,
          data.remark
        ]
      );
      
      return { id: result.lastID, success: true };
    } catch (error) {
      logger.error('Create verify record failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async findById(id) {
    try {
      return await get('SELECT * FROM verify_records WHERE id = ?', [id]);
    } catch (error) {
      logger.error('Find verify record by id failed:', error);
      return null;
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM verify_records WHERE 1=1';
      const params = [];
      
      if (filters.verifyType) {
        query += ' AND verify_type = ?';
        params.push(filters.verifyType);
      }
      if (filters.isAllowed !== undefined) {
        query += ' AND is_allowed = ?';
        params.push(filters.isAllowed ? 1 : 0);
      }
      if (filters.isInBlacklist !== undefined) {
        query += ' AND is_in_blacklist = ?';
        params.push(filters.isInBlacklist ? 1 : 0);
      }
      if (filters.startDate) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.endDate);
      }
      
      query += ' ORDER BY created_at DESC';
      
      return await all(query, params);
    } catch (error) {
      logger.error('Find all verify records failed:', error);
      return [];
    }
  }

  static async getStatistics(date = null) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total,
          SUM(is_allowed) as allowed,
          SUM(is_in_blacklist) as in_blacklist,
          verify_type
        FROM verify_records
        WHERE 1=1
      `;
      const params = [];
      
      if (date) {
        query += ' AND DATE(created_at) = ?';
        params.push(date);
      }
      
      query += ' GROUP BY verify_type';
      
      return await all(query, params);
    } catch (error) {
      logger.error('Get verify statistics failed:', error);
      return [];
    }
  }
}

module.exports = VerifyRecord;

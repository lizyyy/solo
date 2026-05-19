const { run, get, all } = require('../config/database');
const logger = require('../config/logger');

class Blacklist {
  static async create(data, batchId = null) {
    try {
      const result = await run(
        `INSERT INTO blacklist 
        (batch_id, type, name, phone, id_card, license_plate, reason, level, status, added_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          data.type || 'person',
          data.name,
          data.phone,
          data.idCard || data.id_card,
          data.licensePlate || data.license_plate,
          data.reason,
          data.level || 'normal',
          'active',
          data.addedBy || data.added_by || 'system'
        ]
      );
      
      return { id: result.lastID, success: true };
    } catch (error) {
      logger.error('Create blacklist entry failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async bulkCreate(entries, batchId = null) {
    const results = { success: [], failed: [] };
    
    for (let i = 0; i < entries.length; i++) {
      const result = await this.create(entries[i], batchId);
      if (result.success) {
        results.success.push({ index: i, id: result.id });
      } else {
        results.failed.push({ index: i, error: result.error, data: entries[i] });
      }
    }
    
    return results;
  }

  static async findById(id) {
    try {
      return await get('SELECT * FROM blacklist WHERE id = ?', [id]);
    } catch (error) {
      logger.error('Find blacklist by id failed:', error);
      return null;
    }
  }

  static async checkPhone(phone) {
    try {
      return await get(
        `SELECT * FROM blacklist 
        WHERE phone = ? AND status = 'active' 
        AND (expire_date IS NULL OR expire_date >= DATE('now'))`,
        [phone]
      );
    } catch (error) {
      logger.error('Check phone in blacklist failed:', error);
      return null;
    }
  }

  static async checkLicensePlate(plate) {
    try {
      return await get(
        `SELECT * FROM blacklist 
        WHERE license_plate = ? AND status = 'active' 
        AND (expire_date IS NULL OR expire_date >= DATE('now'))`,
        [plate]
      );
    } catch (error) {
      logger.error('Check plate in blacklist failed:', error);
      return null;
    }
  }

  static async checkIdCard(idCard) {
    try {
      return await get(
        `SELECT * FROM blacklist 
        WHERE id_card = ? AND status = 'active' 
        AND (expire_date IS NULL OR expire_date >= DATE('now'))`,
        [idCard]
      );
    } catch (error) {
      logger.error('Check id card in blacklist failed:', error);
      return null;
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM blacklist WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
      }
      if (filters.level) {
        query += ' AND level = ?';
        params.push(filters.level);
      }
      
      query += ' ORDER BY created_at DESC';
      
      return await all(query, params);
    } catch (error) {
      logger.error('Find all blacklist failed:', error);
      return [];
    }
  }

  static async updateStatus(id, status) {
    try {
      const result = await run(
        'UPDATE blacklist SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      );
      return result.changes > 0;
    } catch (error) {
      logger.error('Update blacklist status failed:', error);
      return false;
    }
  }

  static async delete(id) {
    try {
      const result = await run('DELETE FROM blacklist WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      logger.error('Delete blacklist entry failed:', error);
      return false;
    }
  }
}

module.exports = Blacklist;

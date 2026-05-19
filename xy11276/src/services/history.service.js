const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const logger = require('../utils/logger');
const { maskSensitiveFields } = require('../utils/security');

class HistoryService {
  static async log(entityType, entityId, action, oldValue, newValue, operatorName, operatorRole) {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      const oldValueStr = oldValue ? JSON.stringify(maskSensitiveFields(oldValue)) : null;
      const newValueStr = newValue ? JSON.stringify(maskSensitiveFields(newValue)) : null;
      
      await db.runQuery(
        `INSERT INTO history_logs (id, entityType, entityId, action, oldValue, newValue, operatorName, operatorRole, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, entityType, entityId, action, oldValueStr, newValueStr, operatorName || 'system', operatorRole || 'system', now]
      );
      
      logger.info(`历史记录已创建: ${entityType} ${action} ${entityId}`);
      return id;
    } catch (error) {
      logger.error('创建历史记录失败:', error);
      throw error;
    }
  }

  static async getByEntity(entityType, entityId, limit = 50) {
    try {
      const logs = await db.getAll(
        `SELECT * FROM history_logs 
         WHERE entityType = ? AND entityId = ? 
         ORDER BY createdAt DESC LIMIT ?`,
        [entityType, entityId, limit]
      );
      
      return logs.map(log => ({
        ...log,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null
      }));
    } catch (error) {
      logger.error('查询历史记录失败:', error);
      throw error;
    }
  }

  static async getByType(entityType, limit = 100) {
    try {
      const logs = await db.getAll(
        `SELECT * FROM history_logs 
         WHERE entityType = ? 
         ORDER BY createdAt DESC LIMIT ?`,
        [entityType, limit]
      );
      
      return logs.map(log => ({
        ...log,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null
      }));
    } catch (error) {
      logger.error('查询历史记录失败:', error);
      throw error;
    }
  }

  static async getAll(limit = 200) {
    try {
      const logs = await db.getAll(
        `SELECT * FROM history_logs 
         ORDER BY createdAt DESC LIMIT ?`,
        [limit]
      );
      
      return logs.map(log => ({
        ...log,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null
      }));
    } catch (error) {
      logger.error('查询历史记录失败:', error);
      throw error;
    }
  }

  static async getByDateRange(startDate, endDate, entityType = null) {
    try {
      let sql = `SELECT * FROM history_logs WHERE createdAt >= ? AND createdAt <= ?`;
      let params = [startDate, endDate];
      
      if (entityType) {
        sql += ` AND entityType = ?`;
        params.push(entityType);
      }
      
      sql += ` ORDER BY createdAt DESC`;
      
      const logs = await db.getAll(sql, params);
      
      return logs.map(log => ({
        ...log,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null
      }));
    } catch (error) {
      logger.error('查询历史记录失败:', error);
      throw error;
    }
  }
}

module.exports = HistoryService;
const Joi = require('joi');
const moment = require('moment');
const db = require('../models/database');
const { OperationLogger, logger } = require('../utils/logger');
const SecurityUtils = require('../utils/security');

const blacklistSchema = Joi.object({
  type: Joi.string().required().valid('phone', 'plate', 'id_card'),
  value: Joi.string().required(),
  reason: Joi.string().required().min(1).max(500),
  expires_at: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, '').max(500)
});

class BlacklistService {
  static validateBlacklist(data) {
    const { error, value } = blacklistSchema.validate(data);
    if (error) {
      return { valid: false, error: error.details[0].message };
    }
    
    if (value.expires_at && moment(value.expires_at).isBefore(moment())) {
      return { valid: false, error: '过期时间不能早于当前时间' };
    }
    
    return { valid: true, data: value };
  }

  static async addToBlacklist(data, operator = {}) {
    const validation = this.validateBlacklist(data);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const cleanData = SecurityUtils.sanitizeInput(validation.data);
    
    try {
      const existing = await db.get(
        'SELECT * FROM blacklist WHERE type = ? AND value = ? AND is_active = 1',
        [cleanData.type, cleanData.value]
      );
      
      if (existing) {
        return { success: false, error: '该记录已在黑名单中' };
      }
      
      const result = await db.run(
        `INSERT INTO blacklist (type, value, reason, added_by, expires_at, notes)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          cleanData.type,
          cleanData.value,
          cleanData.reason,
          operator.name || 'system',
          cleanData.expires_at || null,
          cleanData.notes || null
        ]
      );
      
      const recordId = result.lastID;
      OperationLogger.log('add', 'blacklist', recordId, null, cleanData, operator);
      logger.info(`Added to blacklist: ${cleanData.type} - ${cleanData.value}`);
      
      return { success: true, id: recordId };
    } catch (error) {
      logger.error('Failed to add to blacklist:', error);
      return { success: false, error: '添加黑名单失败' };
    }
  }

  static async removeFromBlacklist(id, operator = {}) {
    const record = await db.get('SELECT * FROM blacklist WHERE id = ?', [id]);
    if (!record) {
      return { success: false, error: '记录不存在' };
    }
    
    try {
      await db.run('UPDATE blacklist SET is_active = 0 WHERE id = ?', [id]);
      
      OperationLogger.log('remove', 'blacklist', id, { is_active: 1 }, { is_active: 0 }, operator);
      logger.info(`Removed from blacklist: ${record.type} - ${record.value}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to remove from blacklist:', error);
      return { success: false, error: '移除黑名单失败' };
    }
  }

  static async checkBlacklist(type, value) {
    const record = await db.get(
      'SELECT * FROM blacklist WHERE type = ? AND value = ? AND is_active = 1',
      [type, value]
    );
    
    if (!record) {
      return { inBlacklist: false };
    }
    
    if (record.expires_at && moment(record.expires_at).isBefore(moment())) {
      return { inBlacklist: false };
    }
    
    return {
      inBlacklist: true,
      reason: record.reason,
      added_at: record.added_at,
      added_by: record.added_by
    };
  }

  static async getBlacklist(options = {}) {
    let sql = 'SELECT * FROM blacklist WHERE 1=1';
    const params = [];
    
    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    if (options.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(options.is_active ? 1 : 0);
    }
    
    sql += ' ORDER BY added_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);
    
    const records = await db.all(sql, params);
    return SecurityUtils.maskSensitiveData(records, ['value']);
  }

  static async getBlacklistFull(options = {}) {
    let sql = 'SELECT * FROM blacklist WHERE 1=1';
    const params = [];
    
    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    if (options.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(options.is_active ? 1 : 0);
    }
    
    sql += ' ORDER BY added_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);
    
    return await db.all(sql, params);
  }
}

module.exports = BlacklistService;

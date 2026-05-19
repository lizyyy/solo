const Joi = require('joi');
const moment = require('moment');
const db = require('../models/database');
const { OperationLogger, logger } = require('../utils/logger');
const SecurityUtils = require('../utils/security');

const plateSchema = Joi.object({
  plate_number: Joi.string().required().max(20),
  visitor_name: Joi.string().required().min(1).max(50),
  visitor_phone: Joi.string().required().pattern(/^1[3-9]\d{9}$/),
  valid_from: Joi.string().required(),
  valid_to: Joi.string().required(),
  appointment_id: Joi.number().allow(null),
  notes: Joi.string().allow(null, '').max(500)
});

class TemporaryPlateService {
  static validatePlate(data) {
    const { error, value } = plateSchema.validate(data);
    if (error) {
      return { valid: false, error: error.details[0].message };
    }
    
    const validFrom = moment(value.valid_from);
    const validTo = moment(value.valid_to);
    
    if (validTo.isBefore(validFrom)) {
      return { valid: false, error: '有效期结束时间不能早于开始时间' };
    }
    
    if (validTo.diff(validFrom, 'days') > 30) {
      return { valid: false, error: '有效期不能超过30天' };
    }
    
    return { valid: true, data: value };
  }

  static async createPlate(data, operator = {}) {
    const validation = this.validatePlate(data);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const cleanData = SecurityUtils.sanitizeInput(validation.data);
    
    try {
      const existing = await db.get(
        'SELECT * FROM temporary_plates WHERE plate_number = ? AND status = ?',
        [cleanData.plate_number, 'active']
      );
      
      if (existing) {
        return { success: false, error: '该车牌已有有效的临时通行证' };
      }
      
      const result = await db.run(
        `INSERT INTO temporary_plates 
        (plate_number, visitor_name, visitor_phone, valid_from, valid_to, appointment_id, issued_by, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          cleanData.plate_number,
          cleanData.visitor_name,
          cleanData.visitor_phone,
          cleanData.valid_from,
          cleanData.valid_to,
          cleanData.appointment_id || null,
          operator.name || 'system',
          cleanData.notes || null
        ]
      );
      
      const plateId = result.lastID;
      OperationLogger.log('create', 'temporary_plate', plateId, null, cleanData, operator);
      logger.info(`Temporary plate created: ${cleanData.plate_number}`);
      
      return { success: true, id: plateId };
    } catch (error) {
      logger.error('Failed to create temporary plate:', error);
      return { success: false, error: '创建临时车牌失败' };
    }
  }

  static async revokePlate(id, operator = {}) {
    const plate = await db.get('SELECT * FROM temporary_plates WHERE id = ?', [id]);
    if (!plate) {
      return { success: false, error: '车牌记录不存在' };
    }
    
    if (plate.status === 'revoked') {
      return { success: false, error: '车牌已被吊销' };
    }
    
    try {
      await db.run(
        `UPDATE temporary_plates 
        SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [id]
      );
      
      OperationLogger.log('revoke', 'temporary_plate', id, { status: plate.status }, { status: 'revoked' }, operator);
      logger.info(`Temporary plate revoked: ${plate.plate_number}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to revoke temporary plate:', error);
      return { success: false, error: '吊销失败' };
    }
  }

  static async getPlate(id) {
    const plate = await db.get('SELECT * FROM temporary_plates WHERE id = ?', [id]);
    return plate ? SecurityUtils.maskSensitiveData(plate) : null;
  }

  static async getPlateByNumber(plateNumber) {
    return await db.get(
      'SELECT * FROM temporary_plates WHERE plate_number = ? AND status = ?',
      [plateNumber, 'active']
    );
  }

  static async getPlates(options = {}) {
    let sql = 'SELECT * FROM temporary_plates WHERE 1=1';
    const params = [];
    
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    if (options.plate_number) {
      sql += ' AND plate_number LIKE ?';
      params.push(`%${options.plate_number}%`);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);
    
    const plates = await db.all(sql, params);
    return SecurityUtils.maskSensitiveData(plates);
  }

  static isPlateValid(plate) {
    if (!plate) return false;
    if (plate.status !== 'active') return false;
    
    const now = moment();
    const validFrom = moment(plate.valid_from);
    const validTo = moment(plate.valid_to);
    
    return now.isBetween(validFrom, validTo, null, '[]');
  }

  static async checkExpiredPlates() {
    const plates = await db.all("SELECT * FROM temporary_plates WHERE status = 'active'");
    const expired = [];
    
    plates.forEach(plate => {
      if (!this.isPlateValid(plate)) {
        expired.push(plate);
      }
    });
    
    return expired;
  }
}

module.exports = TemporaryPlateService;

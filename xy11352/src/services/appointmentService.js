const Joi = require('joi');
const moment = require('moment');
const db = require('../models/database');
const { OperationLogger, logger } = require('../utils/logger');
const SecurityUtils = require('../utils/security');
const config = require('../config');

const appointmentSchema = Joi.object({
  visitor_name: Joi.string().required().min(1).max(50),
  visitor_phone: Joi.string().required().pattern(/^1[3-9]\d{9}$/),
  plate_number: Joi.string().allow(null, '').max(20),
  visit_date: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/),
  start_time: Joi.string().required().pattern(/^\d{2}:\d{2}$/),
  end_time: Joi.string().required().pattern(/^\d{2}:\d{2}$/),
  gate: Joi.string().allow(null, '').max(50),
  notes: Joi.string().allow(null, '').max(500),
  company: Joi.string().allow(null, '').max(100),
  purpose: Joi.string().allow(null, '').max(200)
});

class AppointmentService {
  static validateAppointment(data) {
    const { error, value } = appointmentSchema.validate(data);
    if (error) {
      return { valid: false, error: error.details[0].message };
    }
    
    const visitDateTime = moment(`${value.visit_date} ${value.start_time}`);
    const endDateTime = moment(`${value.visit_date} ${value.end_time}`);
    
    if (endDateTime.isBefore(visitDateTime)) {
      return { valid: false, error: '结束时间不能早于开始时间' };
    }
    
    const durationHours = endDateTime.diff(visitDateTime, 'hours', true);
    if (durationHours > config.appointment.maxDurationHours) {
      return { valid: false, error: `预约时长不能超过${config.appointment.maxDurationHours}小时` };
    }
    
    return { valid: true, data: value };
  }

  static async createAppointment(data, operator = {}) {
    const validation = this.validateAppointment(data);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const cleanData = SecurityUtils.sanitizeInput(validation.data);
    
    try {
      let visitor = await db.get('SELECT id FROM visitors WHERE phone = ?', [cleanData.visitor_phone]);
      
      if (!visitor) {
        const result = await db.run(
          'INSERT INTO visitors (name, phone, company, purpose) VALUES (?, ?, ?, ?)',
          [cleanData.visitor_name, cleanData.visitor_phone, cleanData.company || null, cleanData.purpose || null]
        );
        visitor = { id: result.lastID };
      }
      
      const result = await db.run(
        `INSERT INTO appointments 
        (visitor_id, visitor_name, visitor_phone, plate_number, visit_date, start_time, end_time, gate, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          visitor.id,
          cleanData.visitor_name,
          cleanData.visitor_phone,
          cleanData.plate_number || null,
          cleanData.visit_date,
          cleanData.start_time,
          cleanData.end_time,
          cleanData.gate || null,
          cleanData.notes || null
        ]
      );
      
      const appointmentId = result.lastID;
      
      OperationLogger.log('create', 'appointment', appointmentId, null, cleanData, operator);
      logger.info(`Appointment created: ${appointmentId}`, { visitor: cleanData.visitor_name });
      
      return { success: true, id: appointmentId };
    } catch (error) {
      logger.error('Failed to create appointment:', error);
      return { success: false, error: '创建预约失败' };
    }
  }

  static async approveAppointment(id, operator = {}) {
    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }
    
    if (appointment.status !== 'pending') {
      return { success: false, error: '只能审批待审核的预约' };
    }
    
    try {
      await db.run(
        `UPDATE appointments 
        SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [operator.name || 'system', id]
      );
      
      OperationLogger.log('approve', 'appointment', id, { status: appointment.status }, { status: 'approved' }, operator);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to approve appointment:', error);
      return { success: false, error: '审批失败' };
    }
  }

  static async cancelAppointment(id, operator = {}) {
    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }
    
    if (appointment.status === 'cancelled') {
      return { success: false, error: '预约已取消' };
    }
    
    try {
      await db.run(
        `UPDATE appointments 
        SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [id]
      );
      
      OperationLogger.log('cancel', 'appointment', id, { status: appointment.status }, { status: 'cancelled' }, operator);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to cancel appointment:', error);
      return { success: false, error: '取消失败' };
    }
  }

  static async getAppointment(id) {
    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    return appointment ? SecurityUtils.maskSensitiveData(appointment) : null;
  }

  static async getAppointments(options = {}) {
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    if (options.visit_date) {
      sql += ' AND visit_date = ?';
      params.push(options.visit_date);
    }
    if (options.visitor_phone) {
      sql += ' AND visitor_phone = ?';
      params.push(options.visitor_phone);
    }
    if (options.plate_number) {
      sql += ' AND plate_number = ?';
      params.push(options.plate_number);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);
    
    const appointments = await db.all(sql, params);
    return SecurityUtils.maskSensitiveData(appointments);
  }

  static isAppointmentExpired(appointment) {
    if (!appointment) return true;
    
    const now = moment();
    const appointmentEnd = moment(`${appointment.visit_date} ${appointment.end_time}`);
    const expiredThreshold = appointmentEnd.add(config.appointment.expiredThresholdMinutes, 'minutes');
    
    return now.isAfter(expiredThreshold);
  }

  static async checkExpiredAppointments() {
    const today = moment().format('YYYY-MM-DD');
    const appointments = await db.all(
      `SELECT * FROM appointments 
      WHERE status = 'approved' 
      AND visit_date <= ?`,
      [today]
    );
    
    const expired = [];
    appointments.forEach(apt => {
      if (this.isAppointmentExpired(apt)) {
        expired.push(apt);
      }
    });
    
    return expired;
  }
}

module.exports = AppointmentService;

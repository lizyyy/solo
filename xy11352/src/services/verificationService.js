const moment = require('moment');
const AppointmentService = require('./appointmentService');
const TemporaryPlateService = require('./temporaryPlateService');
const BlacklistService = require('./blacklistService');
const { OperationLogger, logger } = require('../utils/logger');

class VerificationService {
  static async verifyByPhone(phone, gate = null, operator = {}) {
    const result = {
      success: false,
      allowed: false,
      action: 'block',
      reason: '',
      details: {}
    };
    
    const blacklistCheck = await BlacklistService.checkBlacklist('phone', phone);
    if (blacklistCheck.inBlacklist) {
      result.reason = `手机号在黑名单中：${blacklistCheck.reason}`;
      result.details = { blacklist: blacklistCheck };
      await OperationLogger.logVerification('phone', phone, 'failed', 'block', result.reason, gate, operator, result.details);
      return result;
    }
    
    const today = moment().format('YYYY-MM-DD');
    const appointments = await AppointmentService.getAppointments({
      visitor_phone: phone,
      visit_date: today,
      status: 'approved'
    });
    
    if (appointments.length === 0) {
      result.reason = '今日无有效预约';
      await OperationLogger.logVerification('phone', phone, 'failed', 'block', result.reason, gate, operator, result.details);
      return result;
    }
    
    const validAppointments = appointments.filter(apt => {
      return !AppointmentService.isAppointmentExpired(apt);
    });
    
    if (validAppointments.length === 0) {
      result.reason = '所有预约已过期';
      result.details = { expiredAppointments: appointments };
      await OperationLogger.logVerification('phone', phone, 'failed', 'block', result.reason, gate, operator, result.details);
      return result;
    }
    
    result.success = true;
    result.allowed = true;
    result.action = 'allow';
    result.reason = '验证通过，有有效预约';
    result.details = { appointments: validAppointments };
    
    await OperationLogger.logVerification('phone', phone, 'success', 'allow', result.reason, gate, operator, result.details);
    logger.info(`Phone verification passed: ${phone}`, { gate });
    
    return result;
  }

  static async verifyByPlate(plateNumber, gate = null, operator = {}) {
    const result = {
      success: false,
      allowed: false,
      action: 'block',
      reason: '',
      details: {}
    };
    
    const blacklistCheck = await BlacklistService.checkBlacklist('plate', plateNumber);
    if (blacklistCheck.inBlacklist) {
      result.reason = `车牌在黑名单中：${blacklistCheck.reason}`;
      result.details = { blacklist: blacklistCheck };
      await OperationLogger.logVerification('plate', plateNumber, 'failed', 'block', result.reason, gate, operator, result.details);
      return result;
    }
    
    const tempPlate = await TemporaryPlateService.getPlateByNumber(plateNumber);
    
    if (!tempPlate) {
      const today = moment().format('YYYY-MM-DD');
      const appointments = await AppointmentService.getAppointments({
        plate_number: plateNumber,
        visit_date: today,
        status: 'approved'
      });
      
      if (appointments.length === 0) {
        result.reason = '无有效临时车牌和预约记录';
        await OperationLogger.logVerification('plate', plateNumber, 'failed', 'block', result.reason, gate, operator, result.details);
        return result;
      }
      
      const validAppointments = appointments.filter(apt => {
        return !AppointmentService.isAppointmentExpired(apt);
      });
      
      if (validAppointments.length === 0) {
        result.reason = '所有预约已过期';
        result.details = { expiredAppointments: appointments };
        await OperationLogger.logVerification('plate', plateNumber, 'failed', 'block', result.reason, gate, operator, result.details);
        return result;
      }
      
      result.success = true;
      result.allowed = true;
      result.action = 'allow';
      result.reason = '验证通过，有有效预约';
      result.details = { appointments: validAppointments, type: 'appointment' };
    } else {
      if (!TemporaryPlateService.isPlateValid(tempPlate)) {
        result.reason = '临时车牌已过期';
        result.details = { plate: tempPlate };
        await OperationLogger.logVerification('plate', plateNumber, 'failed', 'block', result.reason, gate, operator, result.details);
        return result;
      }
      
      result.success = true;
      result.allowed = true;
      result.action = 'allow';
      result.reason = '验证通过，有有效临时车牌';
      result.details = { plate: tempPlate, type: 'temporary_plate' };
    }
    
    await OperationLogger.logVerification('plate', plateNumber, 'success', 'allow', result.reason, gate, operator, result.details);
    logger.info(`Plate verification passed: ${plateNumber}`, { gate });
    
    return result;
  }

  static async forceAllow(verifyType, identifier, reason, gate = null, operator = {}) {
    if (!operator.id || !operator.name) {
      return { success: false, error: '越权放行需要记录操作员信息' };
    }
    
    if (!reason || reason.length < 5) {
      return { success: false, error: '越权放行必须提供详细原因' };
    }
    
    const result = {
      success: true,
      allowed: true,
      action: 'force_allow',
      reason: `越权放行：${reason}`,
      details: { operator: operator.name, forceReason: reason }
    };
    
    await OperationLogger.logVerification(verifyType, identifier, 'forced', 'force_allow', result.reason, gate, operator, result.details);
    logger.warn(`Force allow: ${verifyType} - ${identifier}`, { operator: operator.name, reason, gate });
    
    return result;
  }

  static async getStatistics(startDate = null, endDate = null) {
    const options = { startDate, endDate, limit: 1000 };
    const records = await OperationLogger.getVerificationRecords(options);
    
    const stats = {
      total: records.length,
      success: records.filter(r => r.result === 'success').length,
      failed: records.filter(r => r.result === 'failed').length,
      forced: records.filter(r => r.result === 'forced').length,
      byType: {
        phone: records.filter(r => r.verify_type === 'phone').length,
        plate: records.filter(r => r.verify_type === 'plate').length
      },
      byAction: {
        allow: records.filter(r => r.action === 'allow').length,
        block: records.filter(r => r.action === 'block').length,
        force_allow: records.filter(r => r.action === 'force_allow').length
      },
      blockReasons: this.aggregateBlockReasons(records)
    };
    
    stats.successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(2) + '%' : '0%';
    
    return stats;
  }

  static aggregateBlockReasons(records) {
    const blocked = records.filter(r => r.action === 'block');
    const reasons = {};
    
    blocked.forEach(record => {
      const key = record.reason.split('：')[0];
      reasons[key] = (reasons[key] || 0) + 1;
    });
    
    return reasons;
  }

  static async getRecentVerifications(limit = 20) {
    return await OperationLogger.getVerificationRecords({ limit });
  }
}

module.exports = VerificationService;

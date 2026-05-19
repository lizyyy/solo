const db = require('../models/database');
const moment = require('moment');

class RuleService {
  async getRules() {
    return await db.all('SELECT * FROM rules WHERE is_enabled = 1');
  }

  async getRuleByType(ruleType) {
    return await db.get('SELECT * FROM rules WHERE rule_type = ? AND is_enabled = 1', [ruleType]);
  }

  async validatePhoto(record) {
    const rule = await this.getRuleByType('photo');
    if (!rule) return { valid: true, reason: null };

    const minPhotos = rule.min_photos;
    const photoCount = record.photo_count || 0;

    if (photoCount < minPhotos) {
      return {
        valid: false,
        reason: `缺图拦截：照片数量不足，当前${photoCount}张，要求至少${minPhotos}张`,
        exceptionType: 'missing_photos'
      };
    }

    return { valid: true, reason: null };
  }

  async validateTimeout(record) {
    const rule = await this.getRuleByType('timeout');
    if (!rule) return { valid: true, reason: null, deduction: 0 };

    if (!record.start_time || !record.end_time) {
      return { valid: true, reason: null, deduction: 0 };
    }

    const startTime = moment(record.start_time);
    const endTime = moment(record.end_time);
    const durationMinutes = endTime.diff(startTime, 'minutes');
    const timeoutMinutes = rule.timeout_minutes;

    if (durationMinutes > timeoutMinutes) {
      const overMinutes = durationMinutes - timeoutMinutes;
      const deduction = Math.ceil(overMinutes / 10) * rule.deduction_per_timeout;

      return {
        valid: false,
        reason: `超时扣分：用时${durationMinutes}分钟，超时${overMinutes}分钟，扣${deduction}分`,
        exceptionType: 'timeout',
        deduction: deduction
      };
    }

    return { valid: true, reason: null, deduction: 0 };
  }

  async validateRework(record) {
    const rule = await this.getRuleByType('rework');
    if (!rule) return { valid: true, reason: null, deduction: 0 };

    if (record.is_reworked || record.rework_count > 0) {
      const deduction = record.rework_count * rule.deduction_per_rework;
      return {
        valid: false,
        reason: `返工影响：返工${record.rework_count}次，扣款${deduction}元`,
        exceptionType: 'rework',
        deduction: deduction
      };
    }

    return { valid: true, reason: null, deduction: 0 };
  }

  async validateRecord(record) {
    const exceptions = [];
    const reasons = [];
    let totalDeduction = 0;
    let score = 100;

    const photoResult = await this.validatePhoto(record);
    if (!photoResult.valid) {
      exceptions.push(photoResult.exceptionType);
      reasons.push(photoResult.reason);
    }

    const timeoutResult = await this.validateTimeout(record);
    if (!timeoutResult.valid) {
      exceptions.push(timeoutResult.exceptionType);
      reasons.push(timeoutResult.reason);
      score -= timeoutResult.deduction;
    }

    const reworkResult = await this.validateRework(record);
    if (!reworkResult.valid) {
      exceptions.push(reworkResult.exceptionType);
      reasons.push(reworkResult.reason);
      totalDeduction += reworkResult.deduction;
    }

    const status = exceptions.length > 0 ? 'blocked' : 'passed';

    return {
      status,
      exceptions: exceptions.join(','),
      reasons: reasons.join('; '),
      score: Math.max(0, score),
      deductionAmount: totalDeduction
    };
  }

  async addAuditLog(recordId, action, operator, reason, details = null) {
    await db.run(
      'INSERT INTO audit_logs (record_id, action, operator, reason, details) VALUES (?, ?, ?, ?, ?)',
      [recordId, action, operator, reason, details ? JSON.stringify(details) : null]
    );
  }

  async getAuditLogs(recordId) {
    return await db.all('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC', [recordId]);
  }
}

module.exports = new RuleService();

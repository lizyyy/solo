const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

class CompensationEngine {
  static TEMP_LOW_LIMIT = 55;
  static TEMP_HIGH_LIMIT = 85;
  static TEMP_DURATION_THRESHOLD = 10;

  static checkTemperatureAbnormality(segment) {
    const records = JSON.parse(segment.temp_records || '[]');
    if (records.length === 0) return { abnormal: false };

    let abnormalCount = 0;
    let maxAbnormal = 0;
    let currentAbnormal = 0;
    const abnormalTemps = [];

    records.forEach(record => {
      const temp = record.temperature;
      if (temp < this.TEMP_LOW_LIMIT || temp > this.TEMP_HIGH_LIMIT) {
        currentAbnormal++;
        abnormalCount++;
        maxAbnormal = Math.max(maxAbnormal, currentAbnormal);
        abnormalTemps.push({ time: record.time, temp });
      } else {
        currentAbnormal = 0;
      }
    });

    const totalRecords = records.length;
    const abnormalPercent = (abnormalCount / totalRecords) * 100;
    const consecutiveAbnormal = maxAbnormal;

    if (abnormalPercent > 30 || consecutiveAbnormal > this.TEMP_DURATION_THRESHOLD) {
      return {
        abnormal: true,
        reason: `温度异常: 异常比例${abnormalPercent.toFixed(1)}%, 连续异常${consecutiveAbnormal}个点`,
        severity: abnormalPercent > 60 ? 'high' : 'medium',
        abnormalTemps: abnormalTemps.slice(0, 5)
      };
    }

    return { abnormal: false };
  }

  static checkReturnAbnormality(returnReason) {
    const reasonCode = returnReason.reason_code;
    const highRiskCodes = ['T001', 'T002', 'F001', 'F002'];

    if (highRiskCodes.includes(reasonCode)) {
      return {
        abnormal: true,
        severity: reasonCode.startsWith('T') ? 'high' : 'medium',
        reason: this.getReturnReasonText(reasonCode)
      };
    }

    return { abnormal: false };
  }

  static getReturnReasonText(code) {
    const reasons = {
      'T001': '温度过低',
      'T002': '温度过高',
      'T003': '保温箱温度异常',
      'F001': '发现异物',
      'F002': '变质异味',
      'F003': '外观损坏',
      'O001': '老人不在家',
      'O002': '数量不符',
      'O003': '配送延迟'
    };
    return reasons[code] || code;
  }

  static getActiveRules() {
    return db.prepare('SELECT * FROM compensation_rules WHERE is_active = 1').all();
  }

  static calculateCompensation(batch, segment, returnReason) {
    const rules = this.getActiveRules();
    const compensations = [];

    rules.forEach(rule => {
      let triggered = false;
      let compensationAmount = 0;
      let reason = '';

      if (rule.trigger_type === 'temperature' && segment) {
        const tempCheck = this.checkTemperatureAbnormality(segment);
        if (tempCheck.abnormal) {
          triggered = true;
          if (rule.compensation_type === 'fixed') {
            compensationAmount = rule.compensation_amount;
          } else if (rule.compensation_type === 'percent') {
            compensationAmount = batch.total_meals * 15 * (rule.compensation_percent / 100);
          }
          reason = `温度异常: ${tempCheck.reason}`;
        }
      }

      if (rule.trigger_type === 'return' && returnReason) {
        const returnCheck = this.checkReturnAbnormality(returnReason);
        if (returnCheck.abnormal) {
          triggered = true;
          if (rule.compensation_type === 'fixed') {
            compensationAmount = rule.compensation_amount * (returnReason.meals_returned || 1);
          } else if (rule.compensation_type === 'percent') {
            compensationAmount = (returnReason.meals_returned || 1) * 15 * (rule.compensation_percent / 100);
          }
          reason = `退餐异常: ${returnCheck.reason}`;
        }
      }

      if (triggered && compensationAmount > 0) {
        compensations.push({
          rule_id: rule.id,
          compensation_type: rule.compensation_type,
          compensation_amount: compensationAmount,
          reason: reason
        });
      }
    });

    return compensations;
  }

  static createCompensation(data) {
    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    db.prepare(`
      INSERT INTO compensations (
        id, batch_id, receipt_id, return_id, rule_id, elderly_id, elderly_name,
        compensation_type, compensation_amount, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.batch_id,
      data.receipt_id || null,
      data.return_id || null,
      data.rule_id || null,
      data.elderly_id || null,
      data.elderly_name || null,
      data.compensation_type,
      data.compensation_amount,
      data.reason,
      'pending',
      now
    );

    return id;
  }

  static autoGenerateCompensations(batchId) {
    const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(batchId);
    if (!batch) return [];

    const segments = db.prepare('SELECT * FROM temperature_segments WHERE batch_id = ?').all(batchId);
    const returnReasons = db.prepare(`
      SELECT rr.*, sr.elderly_id, sr.elderly_name 
      FROM return_reasons rr
      JOIN sign_receipts sr ON rr.receipt_id = sr.id
      WHERE sr.batch_id = ?
    `).all(batchId);

    const createdIds = [];

    segments.forEach(segment => {
      const compensations = this.calculateCompensation(batch, segment, null);
      compensations.forEach(comp => {
        const id = this.createCompensation({
          batch_id: batchId,
          rule_id: comp.rule_id,
          compensation_type: comp.compensation_type,
          compensation_amount: comp.compensation_amount,
          reason: comp.reason
        });
        createdIds.push(id);
      });
    });

    returnReasons.forEach(returnReason => {
      const compensations = this.calculateCompensation(batch, null, returnReason);
      compensations.forEach(comp => {
        const id = this.createCompensation({
          batch_id: batchId,
          receipt_id: null,
          return_id: returnReason.id,
          rule_id: comp.rule_id,
          elderly_id: returnReason.elderly_id,
          elderly_name: returnReason.elderly_name,
          compensation_type: comp.compensation_type,
          compensation_amount: comp.compensation_amount,
          reason: comp.reason
        });
        createdIds.push(id);
      });
    });

    return createdIds;
  }

  static createSafetyIncident(data) {
    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    db.prepare(`
      INSERT INTO safety_incidents (
        id, batch_id, incident_type, severity, description,
        affected_count, status, reporter, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.batch_id,
      data.incident_type,
      data.severity,
      data.description,
      data.affected_count || 0,
      'open',
      data.reporter || '系统',
      now
    );

    return id;
  }

  static checkAndCreateSafetyIncidents(batchId) {
    const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(batchId);
    if (!batch) return [];

    const segments = db.prepare('SELECT * FROM temperature_segments WHERE batch_id = ?').all(batchId);
    const returnReasons = db.prepare(`
      SELECT rr.*, sr.elderly_name 
      FROM return_reasons rr
      JOIN sign_receipts sr ON rr.receipt_id = sr.id
      WHERE sr.batch_id = ? AND rr.status = 'approved'
    `).all(batchId);

    const incidents = [];

    segments.forEach(segment => {
      const tempCheck = this.checkTemperatureAbnormality(segment);
      if (tempCheck.abnormal && tempCheck.severity === 'high') {
        const incidentId = this.createSafetyIncident({
          batch_id: batchId,
          incident_type: 'temperature',
          severity: 'high',
          description: `${segment.segment_name} - ${tempCheck.reason}`,
          affected_count: batch.total_meals,
          reporter: '温度监控系统'
        });
        incidents.push(incidentId);
      }
    });

    const foodSafetyReturns = returnReasons.filter(r => 
      ['F001', 'F002'].includes(r.reason_code)
    );

    if (foodSafetyReturns.length > 0) {
      const affectedNames = foodSafetyReturns.map(r => r.elderly_name).join('、');
      const incidentId = this.createSafetyIncident({
        batch_id: batchId,
        incident_type: 'food_safety',
        severity: 'high',
        description: `食品安全问题: ${affectedNames} - ${this.getReturnReasonText(foodSafetyReturns[0].reason_code)}`,
        affected_count: foodSafetyReturns.reduce((sum, r) => sum + (r.meals_returned || 0), 0),
        reporter: '退餐审核系统'
      });
      incidents.push(incidentId);
    }

    return incidents;
  }
}

module.exports = CompensationEngine;

const { allQuery, runQuery, getQuery } = require('./database');
const moment = require('moment');

const checkWindowConflict = async (serviceName, windowStart, windowEnd, excludeId = null) => {
  let sql = `
    SELECT * FROM appointments 
    WHERE status IN ('pending', 'approved', 'confirmed')
    AND (
      (window_start < ? AND window_end > ?) OR
      (window_start >= ? AND window_start < ?) OR
      (window_end > ? AND window_end <= ?)
    )
  `;
  const params = [windowEnd, windowStart, windowStart, windowEnd, windowStart, windowEnd];
  
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  
  const conflicts = await allQuery(sql, params);
  
  if (conflicts.length > 0) {
    return {
      hasConflict: true,
      conflicts: conflicts,
      reason: `检测到 ${conflicts.length} 个窗口冲突: ${conflicts.map(c => `#${c.id}-${c.service_name}`).join(', ')}`
    };
  }
  
  return { hasConflict: false, conflicts: [], reason: null };
};

const checkDependencies = async (dependentServices, windowStart, windowEnd) => {
  if (!dependentServices || dependentServices.length === 0) {
    return { valid: true, invalidDependencies: [], reason: null };
  }
  
  const services = dependentServices.split(',').map(s => s.trim());
  const invalidDeps = [];
  
  for (const service of services) {
    const appointments = await allQuery(`
      SELECT * FROM appointments 
      WHERE service_name = ? 
      AND status IN ('pending', 'approved', 'confirmed')
      AND window_start <= ? AND window_end >= ?
    `, [service, windowEnd, windowStart]);
    
    if (appointments.length === 0) {
      invalidDeps.push({
        service: service,
        reason: `依赖服务 ${service} 在该时间窗口内没有有效预约`
      });
    }
  }
  
  if (invalidDeps.length > 0) {
    return {
      valid: false,
      invalidDependencies: invalidDeps,
      reason: `依赖校验失败: ${invalidDeps.map(d => d.reason).join('; ')}`
    };
  }
  
  return { valid: true, invalidDependencies: [], reason: null };
};

const checkRiskLevel = (riskLevel, windowStart, windowEnd) => {
  const start = moment(windowStart);
  const end = moment(windowEnd);
  const duration = end.diff(start, 'hours', true);
  
  if (riskLevel === 'critical' && duration > 2) {
    return {
      valid: false,
      reason: '严重风险变更窗口时长不得超过2小时'
    };
  }
  
  if (riskLevel === 'high' && duration > 4) {
    return {
      valid: false,
      reason: '高风险变更窗口时长不得超过4小时'
    };
  }
  
  return { valid: true, reason: null };
};

const validateAppointment = async (appointmentData, excludeId = null) => {
  const { service_name, window_start, window_end, risk_level, dependent_services } = appointmentData;
  
  const errors = [];
  const rulesApplied = [];
  
  if (!service_name || service_name.trim() === '') {
    errors.push('服务名称不能为空');
  }
  
  if (!window_start || !window_end) {
    errors.push('窗口开始和结束时间不能为空');
  } else {
    const start = moment(window_start);
    const end = moment(window_end);
    
    if (!start.isValid() || !end.isValid()) {
      errors.push('窗口时间格式无效，请使用 ISO 格式');
    } else if (end.isBefore(start)) {
      errors.push('窗口结束时间不能早于开始时间');
    }
    
    rulesApplied.push('时间格式校验');
  }
  
  if (!['low', 'medium', 'high', 'critical'].includes(risk_level)) {
    errors.push('风险等级必须是: low, medium, high, critical');
  } else {
    const riskCheck = checkRiskLevel(risk_level, window_start, window_end);
    if (!riskCheck.valid) {
      errors.push(riskCheck.reason);
    }
    rulesApplied.push('风险等级时长校验');
  }
  
  if (window_start && window_end) {
    const conflictCheck = await checkWindowConflict(service_name, window_start, window_end, excludeId);
    if (conflictCheck.hasConflict) {
      errors.push(conflictCheck.reason);
    }
    rulesApplied.push('窗口冲突检测');
  }
  
  if (dependent_services && window_start && window_end) {
    const depCheck = await checkDependencies(dependent_services, window_start, window_end);
    if (!depCheck.valid) {
      errors.push(depCheck.reason);
    }
    rulesApplied.push('依赖服务校验');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    rulesApplied: rulesApplied
  };
};

const createAuditLog = async (appointmentId, action, originalInput, processingRules, finalConclusion, operator) => {
  await runQuery(`
    INSERT INTO audit_logs (appointment_id, action, original_input, processing_rules, final_conclusion, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    appointmentId,
    action,
    JSON.stringify(originalInput),
    JSON.stringify(processingRules),
    JSON.stringify(finalConclusion),
    operator
  ]);
};

module.exports = {
  checkWindowConflict,
  checkDependencies,
  checkRiskLevel,
  validateAppointment,
  createAuditLog
};

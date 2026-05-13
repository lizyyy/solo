const dayjs = require('dayjs');

function validateLicenseExpiry(license) {
  if (!license || !license.expiryDate) {
    return { valid: false, reason: '未提供驾照有效期', code: 'LICENSE_MISSING' };
  }
  const expiry = dayjs(license.expiryDate);
  const today = dayjs();
  const daysUntilExpiry = expiry.diff(today, 'day');
  
  if (daysUntilExpiry < 0) {
    return { valid: false, reason: `驾照已过期 ${Math.abs(daysUntilExpiry)} 天`, code: 'LICENSE_EXPIRED' };
  }
  
  if (daysUntilExpiry < 30) {
    return { 
      valid: true, 
      warning: true, 
      reason: `驾照将在 ${daysUntilExpiry} 天后过期`, 
      code: 'LICENSE_EXPIRING_SOON',
      warningLevel: 'high'
    };
  }
  
  if (daysUntilExpiry < 90) {
    return { 
      valid: true, 
      warning: true, 
      reason: `驾照将在 ${daysUntilExpiry} 天后过期`, 
      code: 'LICENSE_EXPIRING',
      warningLevel: 'medium'
    };
  }
  
  return { valid: true, reason: '驾照有效期正常', code: 'LICENSE_VALID' };
}

function checkVehicleAvailability(vehicle, appointmentTime) {
  if (!vehicle || !vehicle.id) {
    return { available: false, reason: '未指定试驾车', code: 'VEHICLE_NOT_FOUND' };
  }
  
  if (vehicle.status === 'unavailable') {
    return { available: false, reason: '车辆当前不可用', code: 'VEHICLE_UNAVAILABLE' };
  }
  
  if (vehicle.status === 'locked') {
    return { available: false, reason: '车辆已被锁定', code: 'VEHICLE_LOCKED' };
  }
  
  if (vehicle.maintenance && vehicle.maintenance.includes(appointmentTime)) {
    return { available: false, reason: '车辆在预约时间有保养安排', code: 'VEHICLE_MAINTENANCE' };
  }
  
  return { available: true, reason: '车辆可用', code: 'VEHICLE_AVAILABLE' };
}

function validateInsuranceRules(vehicle, customerAge, hasAccidentHistory = false) {
  const violations = [];
  const warnings = [];
  
  if (!vehicle.insurance || !vehicle.insurance.valid) {
    violations.push({ reason: '车辆保险无效', code: 'INSURANCE_INVALID' });
  }
  
  if (vehicle.insurance && vehicle.insurance.expiryDate) {
    const expiry = dayjs(vehicle.insurance.expiryDate);
    const today = dayjs();
    const daysUntilExpiry = expiry.diff(today, 'day');
    
    if (daysUntilExpiry < 0) {
      violations.push({ reason: '车辆保险已过期', code: 'INSURANCE_EXPIRED' });
    } else if (daysUntilExpiry < 30) {
      warnings.push({ reason: `车辆保险将在 ${daysUntilExpiry} 天后过期`, code: 'INSURANCE_EXPIRING_SOON', level: 'high' });
    }
  }
  
  if (customerAge && customerAge < 21) {
    violations.push({ reason: '试驾人年龄未满21岁，不符合保险条款', code: 'INSURANCE_AGE_TOO_YOUNG' });
  }
  
  if (hasAccidentHistory) {
    warnings.push({ reason: '客户有事故历史记录，需额外确认', code: 'INSURANCE_ACCIDENT_HISTORY', level: 'medium' });
  }
  
  if (violations.length > 0) {
    return { valid: false, violations, warnings };
  }
  
  return { valid: true, warnings };
}

function checkNoShowRelease(appointment, noShowThresholdHours = 1) {
  if (appointment.status !== 'confirmed') {
    return { shouldRelease: false, reason: '预约状态非已确认' };
  }
  
  const startTime = dayjs(appointment.startTime);
  const now = dayjs();
  const hoursSinceStart = now.diff(startTime, 'hour');
  
  if (hoursSinceStart >= noShowThresholdHours) {
    return { 
      shouldRelease: true, 
      reason: `预约已超过开始时间 ${hoursSinceStart} 小时，满足爽约释放条件`,
      hoursOverdue: hoursSinceStart,
      threshold: noShowThresholdHours
    };
  }
  
  return { 
    shouldRelease: false, 
    reason: `距离预约开始时间不足 ${noShowThresholdHours} 小时，暂不释放`,
    hoursUntilRelease: noShowThresholdHours - hoursSinceStart
  };
}

function validateSalespersonSchedule(salesperson, appointment) {
  const startTime = dayjs(appointment.startTime);
  const endTime = dayjs(appointment.endTime);
  
  const conflicts = salesperson.schedule?.filter(slot => {
    const slotStart = dayjs(slot.startTime);
    const slotEnd = dayjs(slot.endTime);
    return (startTime.isBefore(slotEnd) && endTime.isAfter(slotStart)) && slot.id !== appointment.id;
  }) || [];
  
  if (conflicts.length > 0) {
    return { 
      available: false, 
      reason: `销售顾问在该时间段有 ${conflicts.length} 个冲突安排`, 
      conflicts
    };
  }
  
  return { available: true, reason: '销售顾问日程可用' };
}

function validateRepeatOperation(operationHistory, operationId, operationType) {
  const existing = operationHistory?.find(op => 
    op.operationId === operationId && op.operationType === operationType
  );
  
  if (existing) {
    return { 
      isDuplicate: true, 
      existingOperation: existing,
      message: '操作已执行过，忽略重复请求'
    };
  }
  
  return { isDuplicate: false, message: '操作可执行' };
}

module.exports = {
  validateLicenseExpiry,
  checkVehicleAvailability,
  validateInsuranceRules,
  checkNoShowRelease,
  validateSalespersonSchedule,
  validateRepeatOperation
};

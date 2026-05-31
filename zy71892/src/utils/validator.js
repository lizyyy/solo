const VALID_FIELDS = {
  shiftRecord: ['date', 'shift', 'trainNo', 'carriageNo', 'brakePosition', 'temperature', 'operator', 'notes'],
  inspection: ['date', 'inspector', 'trainNo', 'carriageNo', 'brakePosition', 'temperature', 'threshold', 'alarmLevel', 'alarmSource', 'alarmId', 'confirmedBy', 'confirmSource', 'nextAction', 'notes']
};

const ALARM_SOURCES = ['maintenance_order', 'vibration_curve', 'manual_report', 'system_auto'];
const CONFIRM_SOURCES = ['maintenance_order', 'vibration_curve', 'onsite_verification', 'other'];
const ALARM_LEVELS = ['normal', 'warning', 'critical'];
const STATUSES = ['pending', 'reviewed', 'corrected'];

function validateBrakeRecord(record, type = 'shift') {
  const errors = [];
  
  if (!record.date) {
    errors.push('缺少日期字段: date');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    errors.push('日期格式错误，应为 YYYY-MM-DD');
  }

  if (!record.trainNo) {
    errors.push('缺少车组号: trainNo');
  }

  if (!record.carriageNo) {
    errors.push('缺少车厢号: carriageNo');
  }

  if (record.temperature === undefined || record.temperature === null) {
    errors.push('缺少温度值: temperature');
  } else if (typeof record.temperature !== 'number') {
    errors.push('温度值必须是数字');
  }

  if (type === 'inspection') {
    if (record.alarmLevel && !ALARM_LEVELS.includes(record.alarmLevel)) {
      errors.push(`报警级别无效，可选值: ${ALARM_LEVELS.join(', ')}`);
    }
    if (record.alarmSource && !ALARM_SOURCES.includes(record.alarmSource)) {
      errors.push(`报警来源无效，可选值: ${ALARM_SOURCES.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function normalizeRecord(record, type = 'shift') {
  const normalized = {
    ...record,
    type,
    status: record.status || 'pending',
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    temperature: Number(record.temperature)
  };

  if (type === 'inspection' && !normalized.threshold) {
    normalized.threshold = 85;
  }

  if (normalized.temperature !== undefined) {
    if (!normalized.alarmLevel) {
      if (normalized.temperature >= 85) {
        normalized.alarmLevel = 'critical';
      } else if (normalized.temperature >= 70) {
        normalized.alarmLevel = 'warning';
      } else {
        normalized.alarmLevel = 'normal';
      }
    }
  }

  return normalized;
}

module.exports = {
  validateBrakeRecord,
  normalizeRecord,
  VALID_FIELDS,
  ALARM_SOURCES,
  CONFIRM_SOURCES,
  ALARM_LEVELS,
  STATUSES
};

const dayjs = require('dayjs');
const { TEMPERATURE_THRESHOLDS } = require('../models/types');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidLotNumber(lotNumber) {
  if (!isNonEmptyString(lotNumber)) {
    return { valid: false, reason: '批号不能为空' };
  }
  if (lotNumber.length < 3) {
    return { valid: false, reason: `批号长度过短 (${lotNumber.length} 位), 至少需要 3 位` };
  }
  return { valid: true };
}

function isValidQuantity(quantity) {
  const qty = Number(quantity);
  if (isNaN(qty)) {
    return { valid: false, reason: `数量不是有效数字: ${quantity}` };
  }
  if (qty < 0) {
    return { valid: false, reason: `数量不能为负数: ${qty}` };
  }
  if (!Number.isInteger(qty) && !isDecimal(qty)) {
    return { valid: false, reason: `数量格式异常: ${quantity}` };
  }
  return { valid: true };
}

function isDecimal(value) {
  const str = String(value);
  return /^\d+(\.\d+)?$/.test(str);
}

function isValidTemperature(temperature) {
  const temp = Number(temperature);
  if (isNaN(temp)) {
    return { valid: false, reason: `温度不是有效数字: ${temperature}` };
  }
  if (temp < -50 || temp > 50) {
    return { valid: false, reason: `温度超出合理范围 (-50 ~ 50°C): ${temp}°C` };
  }
  return { valid: true };
}

function isValidTemperatureZone(zone) {
  if (!isNonEmptyString(zone)) {
    return { valid: false, reason: '温区不能为空' };
  }
  if (!TEMPERATURE_THRESHOLDS[zone]) {
    return {
      valid: false,
      reason: `未知温区: ${zone}, 有效温区: ${Object.keys(TEMPERATURE_THRESHOLDS).join(', ')}`
    };
  }
  return { valid: true };
}

function isValidDateTime(datetime) {
  if (!isNonEmptyString(datetime)) {
    return { valid: false, reason: '时间不能为空' };
  }
  const d = dayjs(datetime);
  if (!d.isValid()) {
    return { valid: false, reason: `时间格式无效: ${datetime}` };
  }
  if (d.isAfter(dayjs())) {
    return { valid: false, reason: `时间不能是未来时间: ${datetime}` };
  }
  return { valid: true };
}

function isTemperatureInZone(temperature, zone) {
  const threshold = TEMPERATURE_THRESHOLDS[zone];
  if (!threshold) return { valid: false, reason: `未知温区: ${zone}` };
  
  const temp = Number(temperature);
  if (temp < threshold.min || temp > threshold.max) {
    return {
      valid: false,
      reason: `温度 ${temp}°C 超出 ${zone} 正常范围 (${threshold.min} ~ ${threshold.max}°C)`
    };
  }
  return { valid: true };
}

function validateRow(row, schema, rowIndex) {
  const errors = [];
  const warnings = [];
  
  for (const field of schema) {
    const value = row[field.name];
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      errors.push({
        row: rowIndex,
        field: field.name,
        value,
        reason: `必填字段缺失: ${field.name}`
      });
      continue;
    }
    
    if (value === undefined || value === null || String(value).trim() === '') {
      continue;
    }
    
    const validation = field.validator ? field.validator(value) : { valid: true };
    if (!validation.valid) {
      errors.push({
        row: rowIndex,
        field: field.name,
        value,
        reason: validation.reason
      });
    }
  }
  
  return { errors, warnings, hasError: errors.length > 0 };
}

module.exports = {
  isNonEmptyString,
  isValidLotNumber,
  isValidQuantity,
  isValidTemperature,
  isValidTemperatureZone,
  isValidDateTime,
  isTemperatureInZone,
  validateRow
};

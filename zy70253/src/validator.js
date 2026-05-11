const fs = require('fs');
const path = require('path');

const VALID_ACCESS_TYPES = ['OPEN', 'CLOSE', 'GRANTED', 'DENIED'];
const VALID_DOOR_STATUSES = ['OPEN', 'CLOSED'];
const SHIFT_START_HOUR = { '早班': 6, '中班': 14, '晚班': 22 };
const SHIFT_NAMES = Object.keys(SHIFT_START_HOUR);

function parseISO(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function validateAccessLogRow(row, lineNumber) {
  const errors = [];
  const warnings = [];
  
  if (!row.timestamp) errors.push('缺少时间戳');
  else if (!parseISO(row.timestamp)) errors.push('时间戳格式无效');
  
  if (!row.doorId) errors.push('缺少门禁ID');
  
  if (!row.employeeId && !row.cardId) warnings.push('缺少员工ID或卡号');
  
  if (row.accessType && !VALID_ACCESS_TYPES.includes(row.accessType)) {
    warnings.push(`未知的门禁类型: ${row.accessType}`);
  }
  
  if (row.doorStatus && !VALID_DOOR_STATUSES.includes(row.doorStatus)) {
    warnings.push(`未知的门状态: ${row.doorStatus}`);
  }
  
  return { errors, warnings };
}

function validateTemperatureRow(row, lineNumber) {
  const errors = [];
  const warnings = [];
  
  if (!row.timestamp) errors.push('缺少时间戳');
  else if (!parseISO(row.timestamp)) errors.push('时间戳格式无效');
  
  if (row.temperature === undefined || row.temperature === null || row.temperature === '') {
    errors.push('缺少温度值');
  } else {
    const temp = Number(row.temperature);
    if (isNaN(temp)) errors.push('温度值不是有效数字');
    else if (temp > 30 || temp < -40) warnings.push(`温度值超出常规范围: ${temp}°C`);
  }
  
  if (!row.sensorId) warnings.push('缺少传感器ID');
  
  return { errors, warnings };
}

function validateBatchRow(row, lineNumber) {
  const errors = [];
  const warnings = [];
  
  if (!row.batchId) errors.push('缺少批次ID');
  
  if (!row.productName) warnings.push('缺少货品名称');
  
  if (row.storageStart) {
    if (!parseISO(row.storageStart)) errors.push('入库时间格式无效');
  }
  
  if (row.storageEnd) {
    if (!parseISO(row.storageEnd)) errors.push('出库时间格式无效');
  }
  
  if (row.requiredTemp !== undefined && row.requiredTemp !== null && row.requiredTemp !== '') {
    const temp = Number(row.requiredTemp);
    if (isNaN(temp)) warnings.push('要求温度不是有效数字');
  }
  
  if (row.storageStart && row.storageEnd) {
    const start = parseISO(row.storageStart);
    const end = parseISO(row.storageEnd);
    if (start && end && start > end) {
      errors.push('入库时间晚于出库时间');
    }
  }
  
  return { errors, warnings };
}

function validateShiftRow(row, lineNumber) {
  const errors = [];
  const warnings = [];
  
  if (!row.date) errors.push('缺少日期');
  
  if (!row.shiftName) errors.push('缺少班次名称');
  else if (!SHIFT_NAMES.includes(row.shiftName)) {
    warnings.push(`未知班次名称: ${row.shiftName}，期望: ${SHIFT_NAMES.join(', ')}`);
  }
  
  if (!row.employeeId && !row.employeeName) {
    warnings.push('缺少员工信息');
  }
  
  return { errors, warnings };
}

function validateThresholdConfig(config) {
  const errors = [];
  const warnings = [];
  
  if (config.doorOpenDurationThreshold !== undefined) {
    if (typeof config.doorOpenDurationThreshold !== 'number' || config.doorOpenDurationThreshold <= 0) {
      errors.push('门开时长阈值必须是正数');
    }
  }
  
  if (config.temperatureRiseThreshold !== undefined) {
    if (typeof config.temperatureRiseThreshold !== 'number') {
      errors.push('温升阈值必须是数字');
    }
  }
  
  if (config.normalTemperatureRange) {
    if (!Array.isArray(config.normalTemperatureRange) || config.normalTemperatureRange.length !== 2) {
      errors.push('正常温度范围必须是包含两个元素的数组');
    } else if (config.normalTemperatureRange[0] >= config.normalTemperatureRange[1]) {
      errors.push('正常温度范围最小值必须小于最大值');
    }
  }
  
  return { errors, warnings };
}

module.exports = {
  validateAccessLogRow,
  validateTemperatureRow,
  validateBatchRow,
  validateShiftRow,
  validateThresholdConfig,
  parseISO,
  VALID_ACCESS_TYPES,
  VALID_DOOR_STATUSES,
  SHIFT_START_HOUR,
  SHIFT_NAMES
};

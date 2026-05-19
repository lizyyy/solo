import { format, isValid, parse } from 'date-fns';
import { InspectionRecord, SensorAlert } from './database';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
  suggestions: string[];
}

const STATUS_VALUES = ['normal', 'warning', 'error', 'critical'];
const REVIEW_STATUS_VALUES = ['pending', 'reviewed', 'resolved'];
const ALERT_LEVEL_VALUES = ['info', 'warning', 'critical'];

function validateDate(dateStr: string): { valid: boolean; formatted?: string; error?: string } {
  const formats = ['yyyy-MM-dd', 'yyyy/MM/dd', 'yyyyMMdd', 'yyyy-MM-dd HH:mm:ss'];
  for (const fmt of formats) {
    const parsed = parse(dateStr, fmt, new Date());
    if (isValid(parsed)) {
      return { valid: true, formatted: format(parsed, 'yyyy-MM-dd HH:mm:ss') };
    }
  }
  return { valid: false, error: `日期格式无效: ${dateStr}，支持格式: yyyy-MM-dd, yyyy/MM/dd, yyyy-MM-dd HH:mm:ss` };
}

function validateNumber(value: string, fieldName: string): { valid: boolean; num?: number; error?: string; suggestion?: string } {
  if (!value) {
    return { valid: true, num: undefined };
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName}必须是数字`, suggestion: `请将"${value}"修改为有效数字` };
  }
  return { valid: true, num };
}

export function validateInspectionRecord(row: Record<string, string>): ValidationResult<InspectionRecord> {
  const errors: string[] = [];
  const suggestions: string[] = [];
  const data: Partial<InspectionRecord> = {};

  if (!row.inspectionDate && !row['巡检日期']) {
    errors.push('缺少巡检日期');
    suggestions.push('请添加inspectionDate或巡检日期列');
  } else {
    const dateResult = validateDate(row.inspectionDate || row['巡检日期']);
    if (!dateResult.valid) {
      errors.push(dateResult.error!);
      suggestions.push('请修正日期格式，例如: 2024-01-15');
    } else {
      data.inspectionDate = dateResult.formatted;
    }
  }

  const inspector = row.inspector || row['巡检人'];
  if (!inspector) {
    errors.push('缺少巡检人');
    suggestions.push('请添加inspector或巡检人列');
  } else if (inspector.trim().length < 2) {
    errors.push('巡检人姓名至少2个字符');
    suggestions.push(`请将"${inspector}"修改为有效姓名`);
  } else {
    data.inspector = inspector.trim();
  }

  const equipmentName = row.equipmentName || row['设备名称'];
  if (!equipmentName) {
    errors.push('缺少设备名称');
    suggestions.push('请添加equipmentName或设备名称列');
  } else {
    data.equipmentName = equipmentName.trim();
  }

  const location = row.location || row['位置'];
  if (!location) {
    errors.push('缺少位置');
    suggestions.push('请添加location或位置列');
  } else {
    data.location = location.trim();
  }

  const status = (row.status || row['状态'] || '').toLowerCase();
  if (!status) {
    errors.push('缺少状态');
    suggestions.push('请添加status或状态列，可选值: normal, warning, error, critical');
  } else if (!STATUS_VALUES.includes(status)) {
    errors.push(`状态值无效: ${status}`);
    suggestions.push(`请修改为: ${STATUS_VALUES.join(', ')} 其中之一`);
  } else {
    data.status = status as InspectionRecord['status'];
  }

  const tempResult = validateNumber(row.temperature || row['温度'], '温度');
  if (!tempResult.valid) {
    errors.push(tempResult.error!);
    suggestions.push(tempResult.suggestion!);
  } else if (tempResult.num !== undefined) {
    data.temperature = tempResult.num;
  }

  const pressureResult = validateNumber(row.pressure || row['压力'], '压力');
  if (!pressureResult.valid) {
    errors.push(pressureResult.error!);
    suggestions.push(pressureResult.suggestion!);
  } else if (pressureResult.num !== undefined) {
    data.pressure = pressureResult.num;
  }

  const vibrationResult = validateNumber(row.vibration || row['振动'], '振动');
  if (!vibrationResult.valid) {
    errors.push(vibrationResult.error!);
    suggestions.push(vibrationResult.suggestion!);
  } else if (vibrationResult.num !== undefined) {
    data.vibration = vibrationResult.num;
  }

  data.remarks = row.remarks || row['备注'] || '';
  data.reviewStatus = 'pending';

  const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  data.createdAt = now;
  data.updatedAt = now;

  if (errors.length > 0) {
    return { valid: false, errors, suggestions };
  }

  return { valid: true, data: data as InspectionRecord, errors: [], suggestions: [] };
}

export function validateSensorAlert(obj: Record<string, any>): ValidationResult<SensorAlert> {
  const errors: string[] = [];
  const suggestions: string[] = [];
  const data: Partial<SensorAlert> = {};

  if (!obj.sensorId) {
    errors.push('缺少传感器ID (sensorId)');
    suggestions.push('请添加sensorId字段');
  } else {
    data.sensorId = String(obj.sensorId);
  }

  if (!obj.sensorType) {
    errors.push('缺少传感器类型 (sensorType)');
    suggestions.push('请添加sensorType字段，例如: temperature, pressure, vibration');
  } else {
    data.sensorType = String(obj.sensorType);
  }

  if (!obj.location) {
    errors.push('缺少位置 (location)');
    suggestions.push('请添加location字段');
  } else {
    data.location = String(obj.location);
  }

  const alertLevel = String(obj.alertLevel || '').toLowerCase();
  if (!alertLevel) {
    errors.push('缺少告警级别 (alertLevel)');
    suggestions.push('请添加alertLevel字段，可选值: info, warning, critical');
  } else if (!ALERT_LEVEL_VALUES.includes(alertLevel)) {
    errors.push(`告警级别无效: ${alertLevel}`);
    suggestions.push(`请修改为: ${ALERT_LEVEL_VALUES.join(', ')} 其中之一`);
  } else {
    data.alertLevel = alertLevel as SensorAlert['alertLevel'];
  }

  if (obj.value === undefined || obj.value === null) {
    errors.push('缺少数值 (value)');
    suggestions.push('请添加value字段');
  } else if (typeof obj.value !== 'number') {
    errors.push('数值必须是数字类型');
    suggestions.push(`请将"${obj.value}"修改为有效数字`);
  } else {
    data.value = obj.value;
  }

  if (obj.threshold === undefined || obj.threshold === null) {
    errors.push('缺少阈值 (threshold)');
    suggestions.push('请添加threshold字段');
  } else if (typeof obj.threshold !== 'number') {
    errors.push('阈值必须是数字类型');
    suggestions.push(`请将"${obj.threshold}"修改为有效数字`);
  } else {
    data.threshold = obj.threshold;
  }

  if (!obj.alertTime) {
    errors.push('缺少告警时间 (alertTime)');
    suggestions.push('请添加alertTime字段');
  } else {
    const dateResult = validateDate(String(obj.alertTime));
    if (!dateResult.valid) {
      errors.push(dateResult.error!);
      suggestions.push('请修正日期格式，例如: 2024-01-15 14:30:00');
    } else {
      data.alertTime = dateResult.formatted;
    }
  }

  data.isAcknowledged = obj.isAcknowledged ? 1 : 0;
  data.createdAt = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

  if (errors.length > 0) {
    return { valid: false, errors, suggestions };
  }

  return { valid: true, data: data as SensorAlert, errors: [], suggestions: [] };
}

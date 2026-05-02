import dayjs from 'dayjs';
import { SampleType, User, UserRole, Ticket, SampleRecord } from '../types';
import { getThresholdByType } from '../storage/thresholdRepository';
import { getOpenTicketsByPool } from '../storage/ticketRepository';
import { getSampleRecordsByPool } from '../storage/sampleRecordRepository';
import { isDeviceCalibrationValid } from '../storage/deviceCalibrationRepository';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SampleFrequencyConfig {
  sampleType: SampleType;
  requiredPerDay: number;
  timeWindowHours?: number;
}

export const sampleFrequencyConfigs: SampleFrequencyConfig[] = [
  { sampleType: SampleType.CHLORINE, requiredPerDay: 4, timeWindowHours: 6 },
  { sampleType: SampleType.PH, requiredPerDay: 4, timeWindowHours: 6 },
  { sampleType: SampleType.TURBIDITY, requiredPerDay: 1 }
];

export function checkThreshold(
  sampleType: SampleType,
  value: number
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const threshold = getThresholdByType(sampleType);

  if (!threshold) {
    result.valid = false;
    result.errors.push(`未找到 ${sampleType} 的阈值配置`);
    return result;
  }

  if (value < threshold.minValue) {
    result.valid = false;
    result.errors.push(
      `${sampleType} 值 ${value} ${threshold.unit} 低于最低阈值 ${threshold.minValue} ${threshold.unit}`
    );
  }

  if (value > threshold.maxValue) {
    result.valid = false;
    result.errors.push(
      `${sampleType} 值 ${value} ${threshold.unit} 高于最高阈值 ${threshold.maxValue} ${threshold.unit}`
    );
  }

  return result;
}

export function checkDeviceCalibration(
  calibrationId: string | undefined,
  sampleDate: string
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!calibrationId) {
    result.warnings.push('未提供设备校准记录ID，建议确保设备已校准');
    return result;
  }

  const isValid = isDeviceCalibrationValid(calibrationId, sampleDate);
  
  if (!isValid) {
    result.valid = false;
    result.errors.push('设备校准已过期，请重新校准设备');
  }

  return result;
}

export function checkOpenTickets(
  poolId: string,
  sampleType: SampleType
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  
  const openTickets = getOpenTicketsByPool(poolId);
  const sameTypeOpenTickets = openTickets.filter(t => t.sampleType === sampleType);

  if (sameTypeOpenTickets.length > 0) {
    result.warnings.push(
      `该泳池存在 ${sameTypeOpenTickets.length} 个未闭环的 ${sampleType} 整改工单`
    );
  }

  return result;
}

export function checkSampleFrequency(
  poolId: string,
  sampleType: SampleType,
  sampleDate: string
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  
  const config = sampleFrequencyConfigs.find(c => c.sampleType === sampleType);
  if (!config) {
    result.warnings.push(`未找到 ${sampleType} 的采样频次配置`);
    return result;
  }

  const date = dayjs(sampleDate);
  const startOfDay = date.startOf('day').toISOString();
  const endOfDay = date.endOf('day').toISOString();

  const samplesToday = getSampleRecordsByPool(poolId, {
    startDate: startOfDay,
    endDate: endOfDay,
    sampleType
  });

  if (samplesToday.length >= config.requiredPerDay) {
    result.warnings.push(
      `今日 ${sampleType} 采样次数已达 ${samplesToday.length} 次（要求 ${config.requiredPerDay} 次/天）`
    );
  }

  return result;
}

export function checkRetestTime(
  originalSampleTime: string,
  retestTime: string,
  minHours: number = 1,
  maxHours: number = 24
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  
  const original = dayjs(originalSampleTime);
  const retest = dayjs(retestTime);
  const diffHours = retest.diff(original, 'hour');

  if (diffHours < minHours) {
    result.valid = false;
    result.errors.push(
      `复测时间距离原始采样时间不足 ${minHours} 小时（当前间隔 ${diffHours} 小时）`
    );
  }

  if (diffHours > maxHours) {
    result.warnings.push(
      `复测时间距离原始采样时间超过 ${maxHours} 小时（当前间隔 ${diffHours} 小时），建议尽快复测`
    );
  }

  return result;
}

export function checkUserPermission(
  user: User,
  requiredRoles: UserRole[],
  storeId?: string
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!requiredRoles.includes(user.role)) {
    result.valid = false;
    result.errors.push(
      `用户 ${user.username} 的角色 ${user.role} 没有权限执行此操作，需要角色：${requiredRoles.join(', ')}`
    );
    return result;
  }

  if (storeId && user.role === UserRole.STORE_STAFF && user.storeId !== storeId) {
    result.valid = false;
    result.errors.push(
      `门店员工只能操作所属门店的数据`
    );
  }

  return result;
}

export function checkSampleRecordCreation(
  poolId: string,
  sampleType: SampleType,
  value: number,
  sampleTime: string,
  deviceCalibrationId: string | undefined,
  user: User
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const thresholdResult = checkThreshold(sampleType, value);
  result.errors.push(...thresholdResult.errors);
  result.warnings.push(...thresholdResult.warnings);

  const calibrationResult = checkDeviceCalibration(deviceCalibrationId, sampleTime);
  result.errors.push(...calibrationResult.errors);
  result.warnings.push(...calibrationResult.warnings);

  const openTicketsResult = checkOpenTickets(poolId, sampleType);
  result.warnings.push(...openTicketsResult.warnings);

  const frequencyResult = checkSampleFrequency(poolId, sampleType, sampleTime);
  result.warnings.push(...frequencyResult.warnings);

  result.valid = result.errors.length === 0;

  return result;
}

export function checkTicketCreation(
  sampleRecord: SampleRecord
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!sampleRecord.isExceeded) {
    result.valid = false;
    result.errors.push('该采样记录未超标，无需创建整改工单');
    return result;
  }

  if (sampleRecord.ticketId) {
    result.valid = false;
    result.errors.push('该采样记录已关联整改工单');
    return result;
  }

  const openTicketsResult = checkOpenTickets(sampleRecord.poolId, sampleRecord.sampleType);
  result.warnings.push(...openTicketsResult.warnings);

  return result;
}

export function checkRectificationSubmission(
  description: string,
  evidenceUrls: string[]
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!description || description.trim().length === 0) {
    result.valid = false;
    result.errors.push('整改描述不能为空');
  }

  if (description && description.length < 10) {
    result.warnings.push('整改描述过于简短，请提供详细的整改措施');
  }

  if (!evidenceUrls || evidenceUrls.length === 0) {
    result.valid = false;
    result.errors.push('请上传整改证据图片');
  }

  return result;
}

export function checkRetestSubmission(
  retestValue: number,
  originalSampleType: SampleType,
  originalSampleTime: string,
  retestTime: string
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const thresholdResult = checkThreshold(originalSampleType, retestValue);
  if (!thresholdResult.valid) {
    result.warnings.push('复测值仍未达到标准范围');
  }

  const timeResult = checkRetestTime(originalSampleTime, retestTime);
  result.errors.push(...timeResult.errors);
  result.warnings.push(...timeResult.warnings);

  return result;
}

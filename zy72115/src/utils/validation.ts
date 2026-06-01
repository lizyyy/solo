import type { ValidationResult, Direction, AmplitudeUnit, VibrationRecord } from '@/types';
import { DIRECTION_LABELS } from '@/types';

const VALID_DIRECTIONS: Direction[] = ['H', 'V', 'A'];
const VALID_UNITS: AmplitudeUnit[] = ['mm/s', 'μm', 'in/s', 'mil', 'm/s²', 'g'];
const MIN_TIME_INTERVAL_MIN = 5;

export function validateDirection(value: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const upper = value.trim().toUpperCase();
  if (!VALID_DIRECTIONS.includes(upper as Direction)) {
    errors.push(
      `方向符号"${value}"无法识别。请使用 H（水平）、V（垂直）或 A（轴向）。` +
      `当前输入"${value}"不在可选范围内。`
    );
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export function validateAmplitudeUnit(unit: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!VALID_UNITS.includes(unit as AmplitudeUnit)) {
    errors.push(
      `单位"${unit}"不在支持范围内。支持的单位：mm/s、μm、in/s、mil、m/s²、g。`
    );
  } else if (unit !== 'mm/s') {
    warnings.push(
      `单位为${unit}，系统会自动换算为 mm/s 进行阈值判断，请注意换算结果。`
    );
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export function validateTimeGap(recordTime: string, existingRecords: VibrationRecord[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const newTime = new Date(recordTime).getTime();
  if (isNaN(newTime)) {
    errors.push(`时间格式"${recordTime}"无法解析，请使用标准格式如 2024-03-15T10:30:00。`);
    return { isValid: false, errors, warnings };
  }

  for (const record of existingRecords) {
    const existingTime = new Date(record.recordTime).getTime();
    if (isNaN(existingTime)) continue;
    const diffMin = Math.abs(newTime - existingTime) / (1000 * 60);
    if (diffMin < MIN_TIME_INTERVAL_MIN) {
      warnings.push(
        `该记录与已有记录（${record.recordTime}）时间间隔仅 ${diffMin.toFixed(1)} 分钟，` +
        `可能是重复录入，请确认是否为不同测量。`
      );
    }
  }

  return { isValid: true, errors, warnings };
}

export function validateRequiredFields(fields: {
  direction?: string;
  frequencyHz?: number;
  amplitude?: number;
  amplitudeUnit?: string;
  rpm?: number;
  recordTime?: string;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fields.direction) {
    errors.push('缺少测点方向。请填写 H（水平）、V（垂直）或 A（轴向）。');
  }
  if (fields.frequencyHz === undefined || fields.frequencyHz === null) {
    errors.push('缺少频率值。频率是频谱分析的核心参数，请补充。');
  }
  if (fields.amplitude === undefined || fields.amplitude === null) {
    errors.push('缺少幅值。没有幅值无法进行阈值判断，请补充。');
  }
  if (!fields.amplitudeUnit) {
    warnings.push('未指定幅值单位，默认按 mm/s 处理。如实际单位不同，请补充以避免换算错误。');
  }
  if (!fields.rpm) {
    warnings.push('未填写转速(RPM)，无法计算基频和倍频分量。建议补充以获得更完整的分析。');
  }
  if (!fields.recordTime) {
    warnings.push('未填写记录时间，无法检查时间间隔异常。建议补充以避免重复录入。');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export function validateRecord(
  fields: {
    direction?: string;
    frequencyHz?: number;
    amplitude?: number;
    amplitudeUnit?: string;
    rpm?: number;
    recordTime?: string;
  },
  existingRecords: VibrationRecord[]
): ValidationResult {
  const required = validateRequiredFields(fields);
  const allErrors = [...required.errors];
  const allWarnings = [...required.warnings];

  if (fields.direction) {
    const dirResult = validateDirection(fields.direction);
    allErrors.push(...dirResult.errors);
    allWarnings.push(...dirResult.warnings);
  }

  if (fields.amplitudeUnit) {
    const unitResult = validateAmplitudeUnit(fields.amplitudeUnit);
    allErrors.push(...unitResult.errors);
    allWarnings.push(...unitResult.warnings);
  }

  if (fields.recordTime) {
    const timeResult = validateTimeGap(fields.recordTime, existingRecords);
    allErrors.push(...timeResult.errors);
    allWarnings.push(...timeResult.warnings);
  }

  if (fields.frequencyHz !== undefined && fields.frequencyHz <= 0) {
    allErrors.push(`频率值 ${fields.frequencyHz} Hz 无效，频率必须为正数。`);
  }

  if (fields.amplitude !== undefined && fields.amplitude < 0) {
    allWarnings.push(`幅值为负数（${fields.amplitude}），通常振动幅值应为正值，请确认方向符号是否需要调整。`);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

export { DIRECTION_LABELS, VALID_DIRECTIONS, VALID_UNITS };

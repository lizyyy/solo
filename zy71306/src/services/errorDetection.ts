import {
  CalibrationError,
  CalibrationParams,
  ErrorType,
  PHYSICAL_CONSTANTS,
} from '../types/calibration';
import { convertRadiusToCm } from '../utils/physics';

interface ErrorRule {
  type: ErrorType;
  severity: 'low' | 'medium' | 'high';
  check: (params: CalibrationParams) => boolean;
  message: (params: CalibrationParams) => string;
}

const ERROR_RULES: ErrorRule[] = [
  {
    type: 'PRESSURE_TOO_HIGH',
    severity: 'high',
    check: (p) => p.stylusPressure > 2.5,
    message: (p) =>
      `唱针压力过高 (${p.stylusPressure.toFixed(2)}g > 2.5g)，可能导致唱片永久性损坏，建议降低至1.5-2.0g范围`,
  },
  {
    type: 'PRESSURE_TOO_LOW',
    severity: 'medium',
    check: (p) => p.stylusPressure < 1.2,
    message: (p) =>
      `唱针压力过低 (${p.stylusPressure.toFixed(2)}g < 1.2g)，可能导致循迹不良和跳针`,
  },
  {
    type: 'ANTISKATING_DIRECTION_WRONG',
    severity: 'high',
    check: (p) => p.antiSkatingDirection === 'reverse',
    message: () =>
      '抗滑方向错误！反向抗滑会导致唱臂向内偏移，严重加剧内侧音轨磨损，请立即修正方向',
  },
  {
    type: 'RADIUS_UNIT_ERROR',
    severity: 'medium',
    check: (p) => {
      if (p.recordRadiusUnit === 'inch') {
        const radiusCm = convertRadiusToCm(p.recordRadius, p.recordRadiusUnit);
        return (
          radiusCm > PHYSICAL_CONSTANTS.MAX_RECORD_RADIUS_CM ||
          p.recordRadius > 12
        );
      }
      if (p.recordRadiusUnit === 'cm') {
        return (
          p.recordRadius < PHYSICAL_CONSTANTS.MIN_RECORD_RADIUS_CM ||
          p.recordRadius > PHYSICAL_CONSTANTS.MAX_RECORD_RADIUS_CM
        );
      }
      return false;
    },
    message: (p) => {
      if (p.recordRadiusUnit === 'inch' && p.recordRadius > 12) {
        return `唱片半径数值异常 (${p.recordRadius} inch)，可能是单位混淆。12英寸唱片半径应为约6英寸，是否误将厘米数值当作英寸输入？`;
      }
      if (p.recordRadiusUnit === 'cm') {
        const radiusCm = p.recordRadius;
        if (radiusCm < PHYSICAL_CONSTANTS.MIN_RECORD_RADIUS_CM) {
          return `唱片半径过小 (${radiusCm}cm)，请确认数值是否正确`;
        }
        if (radiusCm > PHYSICAL_CONSTANTS.MAX_RECORD_RADIUS_CM) {
          return `唱片半径过大 (${radiusCm}cm)，请确认数值是否正确`;
        }
      }
      return '唱片半径数值异常，请检查单位和数值';
    },
  },
  {
    type: 'TONEARM_LENGTH_MISMATCH',
    severity: 'medium',
    check: (p) => p.tonearmLength < 220 || p.tonearmLength > 280,
    message: (p) =>
      `唱臂长度 (${p.tonearmLength}mm) 超出常见范围 (220-280mm)，请确认唱臂型号是否正确，或添加备注说明特殊型号`,
  },
];

export const detectErrors = (params: CalibrationParams): CalibrationError[] => {
  const now = Date.now();
  const errors: CalibrationError[] = [];

  for (const rule of ERROR_RULES) {
    if (rule.check(params)) {
      errors.push({
        type: rule.type,
        severity: rule.severity,
        message: rule.message(params),
        timestamp: now,
      });
    }
  }

  return errors;
};

export const hasHighSeverityErrors = (errors: CalibrationError[]): boolean => {
  return errors.some((e) => e.severity === 'high');
};

export const getErrorSummary = (errors: CalibrationError[]): string => {
  if (errors.length === 0) return '未检测到异常';

  const highCount = errors.filter((e) => e.severity === 'high').length;
  const mediumCount = errors.filter((e) => e.severity === 'medium').length;
  const lowCount = errors.filter((e) => e.severity === 'low').length;

  const parts: string[] = [];
  if (highCount > 0) parts.push(`${highCount} 个严重问题`);
  if (mediumCount > 0) parts.push(`${mediumCount} 个警告`);
  if (lowCount > 0) parts.push(`${lowCount} 个提示`);

  return `检测到 ${parts.join('，')}`;
};

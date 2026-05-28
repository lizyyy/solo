import type { Quaternion, EulerAngles, ValidationResult } from '@/types';
import { quatNorm, quatIsNormalized } from './quaternion';
import { isGimbalLock } from './euler';
import { isLongPath } from './interpolation';

export function validateQuaternion(q: Quaternion): ValidationResult[] {
  const results: ValidationResult[] = [];
  const norm = quatNorm(q);

  if (!quatIsNormalized(q)) {
    results.push({
      type: 'unnormalized',
      severity: Math.abs(norm - 1.0) > 0.1 ? 'error' : 'warning',
      message: `四元数未归一 (||q|| = ${norm.toFixed(6)})，需要归一化处理`,
      pendingConfirmation: true,
    });
  }

  return results;
}

export function validateEulerAngles(euler: EulerAngles): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (isGimbalLock(euler)) {
    results.push({
      type: 'gimbal_lock',
      severity: 'warning',
      message: `万向节锁检测: pitch 接近 ±90°，旋转自由度退化`,
      pendingConfirmation: true,
    });
  }

  return results;
}

export function validateInterpolation(from: Quaternion, to: Quaternion): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (isLongPath(from, to)) {
    results.push({
      type: 'long_path',
      severity: 'warning',
      message: '插值路径绕远: 起止四元数点积为负，建议取反目标四元数以获得短弧路径',
      pendingConfirmation: true,
    });
  }

  return results;
}

export function validateAll(
  q: Quaternion,
  euler: EulerAngles,
  target: Quaternion
): ValidationResult[] {
  return [
    ...validateQuaternion(q),
    ...validateQuaternion(target),
    ...validateEulerAngles(euler),
    ...validateInterpolation(q, target),
  ];
}

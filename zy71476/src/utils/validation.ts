import {
  ExperimentParams,
  ErrorRecord,
  ErrorType,
  PHYSICAL_CONSTANTS,
  ERROR_MESSAGES,
} from '../types';

const { MIN_ANGLE, MAX_ANGLE, MIN_MASS, MAX_MASS, MIN_FRICTION, MAX_FRICTION } = PHYSICAL_CONSTANTS;

export function validateParams(params: ExperimentParams): ErrorRecord[] {
  const errors: ErrorRecord[] = [];
  const timestamp = Date.now();

  const angleError = validateAngle(params.angle);
  if (angleError) {
    errors.push({
      id: generateId(),
      timestamp,
      type: angleError,
      message: ERROR_MESSAGES[angleError],
      params: { ...params },
      resolved: false,
    });
  }

  const frictionError = validateFriction(params.frictionCoefficient);
  if (frictionError) {
    errors.push({
      id: generateId(),
      timestamp: timestamp + 1,
      type: frictionError,
      message: ERROR_MESSAGES[frictionError],
      params: { ...params },
      resolved: false,
    });
  }

  const massError = validateMass(params.mass);
  if (massError) {
    errors.push({
      id: generateId(),
      timestamp: timestamp + 2,
      type: massError,
      message: ERROR_MESSAGES[massError],
      params: { ...params },
      resolved: false,
    });
  }

  return errors;
}

function validateAngle(angle: number): ErrorType | null {
  if (!isFinite(angle)) return 'angle_unit';
  if (angle < MIN_ANGLE || angle > MAX_ANGLE) return 'angle_out_of_range';
  return null;
}

function validateFriction(friction: number): ErrorType | null {
  if (!isFinite(friction)) return 'friction_out_of_range';
  if (friction < MIN_FRICTION || friction > MAX_FRICTION) return 'friction_out_of_range';
  return null;
}

function validateMass(mass: number): ErrorType | null {
  if (!isFinite(mass) || mass <= 0) return 'mass_zero';
  return null;
}

export function sanitizeParams(params: ExperimentParams): ExperimentParams {
  return {
    angle: clamp(params.angle, MIN_ANGLE, MAX_ANGLE),
    mass: clamp(params.mass, MIN_MASS, MAX_MASS),
    frictionCoefficient: clamp(params.frictionCoefficient, MIN_FRICTION, MAX_FRICTION),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getErrorTypeLabel(type: ErrorType): string {
  const labels: Record<ErrorType, string> = {
    angle_unit: '角度单位错误',
    angle_out_of_range: '角度范围错误',
    friction_out_of_range: '摩擦系数范围错误',
    mass_zero: '质量错误',
    conflict: '参数冲突',
  };
  return labels[type];
}

export function getErrorTypeColor(type: ErrorType): string {
  const colors: Record<ErrorType, string> = {
    angle_unit: '#F59E0B',
    angle_out_of_range: '#F59E0B',
    friction_out_of_range: '#F59E0B',
    mass_zero: '#EF4444',
    conflict: '#8B5CF6',
  };
  return colors[type];
}

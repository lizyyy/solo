import type { SensorRecord, DeviceParam, ValidationIssue } from '../types';

const VALID_DIRECTIONS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
const MIN_TIME_INTERVAL_MS = 10;
const MAX_TIME_INTERVAL_S = 60;

function generateId(): string {
  return `val_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function validateDirection(direction: string, fieldName: string, projectId: string): ValidationIssue | null {
  const trimmed = direction.trim().toUpperCase();

  if (VALID_DIRECTIONS.includes(trimmed)) {
    return null;
  }

  const angleMatch = trimmed.match(/^(\d+(?:\.\d+)?)(?:°|deg)?$/);
  if (angleMatch) {
    const angle = parseFloat(angleMatch[1]);
    if (angle >= 0 && angle <= 360) {
      return null;
    }
  }

  return {
    id: generateId(),
    projectId,
    type: 'direction',
    severity: 'warning',
    field: fieldName,
    message: `方向"${direction}"不是标准符号`,
    suggestion: '请使用标准方向符号(N/S/E/W/NE/NW/SE/SW)或0-360°的角度值',
  };
}

export function validateUnit(
  unit: string,
  quantity: string,
  fieldName: string,
  projectId: string
): ValidationIssue | null {
  const validUnits: Record<string, string[]> = {
    length: ['m', 'cm', 'mm', 'ft', 'in'],
    speed: ['m/s', 'km/h', 'ft/s', 'mph'],
    angle: ['deg', 'rad', '°'],
    mass: ['kg', 'g', 'lb'],
    energy: ['J', 'kJ', 'cal'],
    time: ['s', 'ms'],
    acceleration: ['m/s²', 'g'],
  };

  const units = validUnits[quantity] || [];
  if (units.includes(unit)) {
    return null;
  }

  return {
    id: generateId(),
    projectId,
    type: 'unit',
    severity: 'warning',
    field: fieldName,
    message: `单位"${unit}"不是${quantity}的标准单位`,
    suggestion: `请选择标准单位: ${units.join(', ')}`,
  };
}

export function validateTimeInterval(
  interval: number | null,
  unit: string,
  fieldName: string,
  projectId: string,
  recordId?: string
): ValidationIssue | null {
  if (interval === null || isNaN(interval)) {
    return {
      id: generateId(),
      projectId,
      type: 'timeInterval',
      severity: 'warning',
      field: fieldName,
      recordId,
      message: '时间间隔为空或无法解析',
      suggestion: '请填写有效的时间间隔数值，建议在10ms到60s之间',
    };
  }

  let intervalMs: number;
  if (unit === 'ms') {
    intervalMs = interval;
  } else {
    intervalMs = interval * 1000;
  }

  if (intervalMs < MIN_TIME_INTERVAL_MS) {
    return {
      id: generateId(),
      projectId,
      type: 'timeInterval',
      severity: 'info',
      field: fieldName,
      recordId,
      message: `时间间隔${interval}${unit}偏小`,
      suggestion: '传感器采样间隔过短可能导致数据冗余，建议确认是否真实',
    };
  }

  if (intervalMs > MAX_TIME_INTERVAL_S * 1000) {
    return {
      id: generateId(),
      projectId,
      type: 'timeInterval',
      severity: 'warning',
      field: fieldName,
      recordId,
      message: `时间间隔${interval}${unit}偏大`,
      suggestion: '采样间隔超过60秒可能导致数据不连续，请确认是否正确',
    };
  }

  return null;
}

export function validateValueRange(
  value: number | null,
  min: number,
  max: number,
  fieldName: string,
  projectId: string,
  unit?: string,
  recordId?: string
): ValidationIssue | null {
  if (value === null || isNaN(value)) {
    return {
      id: generateId(),
      projectId,
      type: 'valueRange',
      severity: 'warning',
      field: fieldName,
      recordId,
      message: `${fieldName}数值为空或无法解析`,
      suggestion: '请填写有效的数值',
    };
  }

  if (value < min || value > max) {
    const unitStr = unit ? ` ${unit}` : '';
    return {
      id: generateId(),
      projectId,
      type: 'valueRange',
      severity: 'warning',
      field: fieldName,
      recordId,
      message: `${fieldName}数值${value}${unitStr}超出合理范围[${min}, ${max}]`,
      suggestion: `请确认数值是否正确，正常范围应在${min}到${max}${unitStr}之间`,
    };
  }

  return null;
}

export function parseNumericValue(
  raw: string,
  fieldName: string,
  projectId: string
): { value: number | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { value: null, issues };
  }

  const match = trimmed.match(/^([+-]?\d*\.?\d+)/);
  if (!match) {
    issues.push({
      id: generateId(),
      projectId,
      type: 'format',
      severity: 'error',
      field: fieldName,
      message: `无法从"${raw}"中解析出数值`,
      suggestion: '请检查格式，应为纯数字或数字+单位格式',
    });
    return { value: null, issues };
  }

  const value = parseFloat(match[1]);

  if (trimmed !== match[1]) {
    issues.push({
      id: generateId(),
      projectId,
      type: 'format',
      severity: 'info',
      field: fieldName,
      message: `"${raw}"包含非数字内容，已提取数值: ${value}`,
      suggestion: '建议分离数值和单位到不同字段',
    });
  }

  return { value, issues };
}

export function validateSensorRecords(records: SensorRecord[], projectId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  records.forEach((record) => {
    const dirIssue = validateDirection(record.direction, '方向', projectId);
    if (dirIssue) {
      dirIssue.recordId = record.id;
      issues.push(dirIssue);
    }

    const angleIssue = validateValueRange(record.angle, -90, 90, '发射角度', projectId, record.angleUnit, record.id);
    if (angleIssue) issues.push(angleIssue);

    const velocityIssue = validateValueRange(record.velocity, 0, 300, '发射速度', projectId, record.velocityUnit, record.id);
    if (velocityIssue) issues.push(velocityIssue);

    const timeIssue = validateTimeInterval(
      record.timeInterval,
      record.timeIntervalUnit,
      '采样间隔',
      projectId,
      record.id
    );
    if (timeIssue) issues.push(timeIssue);

    const velocityUnitIssue = validateUnit(record.velocityUnit, 'speed', '速度单位', projectId);
    if (velocityUnitIssue) {
      velocityUnitIssue.recordId = record.id;
      issues.push(velocityUnitIssue);
    }
  });

  const timestamps = records.map((r) => new Date(r.timestamp).getTime());
  const isSorted = timestamps.every((t, i) => i === 0 || t >= timestamps[i - 1]);
  if (!isSorted && records.length > 1) {
    issues.push({
      id: generateId(),
      projectId,
      type: 'format',
      severity: 'warning',
      field: 'timestamp',
      message: '传感器记录时间戳不是按顺序排列的',
      suggestion: '数据可能乱序，建议按时间重新排序或确认记录顺序',
    });
  }

  return issues;
}

export function validateDeviceParams(params: DeviceParam[], projectId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  params.forEach((param) => {
    if (param.value === null) {
      issues.push({
        id: generateId(),
        projectId,
        type: 'valueRange',
        severity: 'warning',
        field: param.paramName,
        message: `参数"${param.paramName}"数值为空`,
        suggestion: '请填写设备参数值，或标记为"待测量"',
      });
      return;
    }

    let min = 0, max = 1000;

    if (param.category === 'material' && param.paramName.includes('质量')) {
      min = 0;
      max = 50;
    } else if (param.category === 'structure') {
      min = 0;
      max = 10;
    } else if (param.category === 'operation') {
      min = 0;
      max = 90;
    }

    const rangeIssue = validateValueRange(param.value, min, max, param.paramName, projectId, param.unit);
    if (rangeIssue) issues.push(rangeIssue);
  });

  return issues;
}

export function markDirtyData(records: SensorRecord[], _projectId: string): SensorRecord[] {
  return records.map((record) => {
    let isDirty = false;
    const reasons: string[] = [];

    if (record.velocity !== null && record.velocity > 100) {
      isDirty = true;
      reasons.push('速度异常高');
    }

    if (record.angle !== null && (record.angle < -45 || record.angle > 80)) {
      isDirty = true;
      reasons.push('角度异常');
    }

    if (record.timeInterval !== null && record.timeInterval > 10) {
      isDirty = true;
      reasons.push('采样间隔过长');
    }

    if (record.acceleration !== null && record.acceleration > 50) {
      isDirty = true;
      reasons.push('加速度异常');
    }

    return {
      ...record,
      isDirty,
      dirtyReason: reasons.length > 0 ? reasons.join('; ') : undefined,
    };
  });
}

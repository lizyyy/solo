import { PendulumData, DataFlag } from '@/types';
import { VALIDATION_RANGES, WARNING_THRESHOLDS } from './constants';

export interface ValidationResult {
  isValid: boolean;
  flags: DataFlag[];
}

export function validateField(field: string, value: number): DataFlag[] {
  const flags: DataFlag[] = [];
  const range = VALIDATION_RANGES[field as keyof typeof VALIDATION_RANGES];
  
  if (!range) return flags;
  
  if (isNaN(value) || value === null || value === undefined) {
    flags.push({
      type: 'error',
      field,
      message: '请输入有效数值',
      suggestion: '确保输入为数字',
    });
    return flags;
  }
  
  if (value < range.min || value > range.max) {
    flags.push({
      type: 'error',
      field,
      message: `数值超出合理范围 (${range.min} - ${range.max} ${range.unit})`,
      suggestion: `请输入 ${range.min} 到 ${range.max} 之间的数值`,
    });
  }
  
  if (field === 'angle' && value > WARNING_THRESHOLDS.angle) {
    flags.push({
      type: 'warning',
      field,
      message: `摆角 ${value}° 较大，小角度近似可能失效`,
      suggestion: '建议摆角小于15度，或启用大角度修正',
    });
  }
  
  if (field === 'measurements' && value < WARNING_THRESHOLDS.measurements) {
    flags.push({
      type: 'warning',
      field,
      message: '测量次数较少，统计误差可能较大',
      suggestion: '建议测量次数不少于5次',
    });
  }
  
  return flags;
}

export function validateSingleData(data: Partial<PendulumData>): DataFlag[] {
  const flags: DataFlag[] = [];
  
  if (data.length !== undefined) {
    flags.push(...validateField('length', data.length));
  }
  
  if (data.period !== undefined) {
    flags.push(...validateField('period', data.period));
  }
  
  if (data.measurements !== undefined) {
    flags.push(...validateField('measurements', data.measurements));
  }
  
  if (data.angle !== undefined) {
    flags.push(...validateField('angle', data.angle));
  }
  
  return flags;
}

export function detectConflicts(dataList: PendulumData[]): Map<string, DataFlag[]> {
  const conflicts = new Map<string, DataFlag[]>();
  const lengthGroups = new Map<number, PendulumData[]>();
  
  dataList.forEach(data => {
    const roundedLength = Math.round(data.length * 100) / 100;
    const existing = lengthGroups.get(roundedLength) || [];
    existing.push(data);
    lengthGroups.set(roundedLength, existing);
  });
  
  lengthGroups.forEach((group, length) => {
    if (group.length < 2) return;
    
    const periods = group.map(d => d.period);
    const maxPeriod = Math.max(...periods);
    const minPeriod = Math.min(...periods);
    const avgPeriod = (maxPeriod + minPeriod) / 2;
    const deviation = (maxPeriod - minPeriod) / avgPeriod;
    
    if (deviation > WARNING_THRESHOLDS.periodDeviation) {
      group.forEach(data => {
        const existing = conflicts.get(data.id) || [];
        existing.push({
          type: 'conflict',
          field: 'period',
          message: `相同摆长 (${length}m) 的周期差异超过10%`,
          suggestion: '请检查测量数据，确认是否保留或重新测量',
        });
        conflicts.set(data.id, existing);
      });
    }
  });
  
  return conflicts;
}

export function validateAllData(dataList: PendulumData[]): PendulumData[] {
  const conflicts = detectConflicts(dataList);
  
  return dataList.map(data => {
    const singleFlags = validateSingleData(data);
    const conflictFlags = conflicts.get(data.id) || [];
    const allFlags = [...singleFlags, ...conflictFlags];
    
    return {
      ...data,
      flags: allFlags,
    };
  });
}

export function hasErrors(data: PendulumData): boolean {
  return data.flags.some(f => f.type === 'error');
}

export function hasWarnings(data: PendulumData): boolean {
  return data.flags.some(f => f.type === 'warning');
}

export function hasConflicts(data: PendulumData): boolean {
  return data.flags.some(f => f.type === 'conflict');
}

export function getErrorCount(dataList: PendulumData[]): number {
  return dataList.filter(d => hasErrors(d)).length;
}

export function getWarningCount(dataList: PendulumData[]): number {
  return dataList.filter(d => hasWarnings(d)).length;
}

export function getConflictCount(dataList: PendulumData[]): number {
  return dataList.filter(d => hasConflicts(d)).length;
}

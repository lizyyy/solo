import type { SafetyRadiusTable } from '../types';

const RADIUS_TOLERANCE = 0.05;

export function validateSafetyRadius(
  logRadius: number | null,
  tableRadius: number | null
): {
  isValid: boolean;
  difference: number;
  radiusSource: 'LOG' | 'TABLE' | 'MANUAL';
  recommendedValue: number | null;
} {
  if (logRadius === null && tableRadius === null) {
    return {
      isValid: false,
      difference: 0,
      radiusSource: 'MANUAL',
      recommendedValue: null,
    };
  }
  
  if (logRadius === null) {
    return {
      isValid: true,
      difference: 0,
      radiusSource: 'TABLE',
      recommendedValue: tableRadius,
    };
  }
  
  if (tableRadius === null) {
    return {
      isValid: true,
      difference: 0,
      radiusSource: 'LOG',
      recommendedValue: logRadius,
    };
  }
  
  const difference = Math.abs(logRadius - tableRadius) / Math.max(tableRadius, 0.001);
  
  if (difference <= RADIUS_TOLERANCE) {
    return {
      isValid: true,
      difference,
      radiusSource: 'TABLE',
      recommendedValue: tableRadius,
    };
  }
  
  return {
    isValid: false,
    difference,
    radiusSource: 'MANUAL',
    recommendedValue: null,
  };
}

export function lookupSafetyRadius(
  safetyRadiusTable: SafetyRadiusTable[],
  distance: number,
  version: string,
  armModel: string
): number | null {
  const matchingRecords = safetyRadiusTable.filter(
    r => r.version === version && r.armModel === armModel
  );
  
  if (matchingRecords.length === 0) {
    return null;
  }
  
  matchingRecords.sort((a, b) => Math.abs(a.distance - distance) - Math.abs(b.distance - distance));
  
  return matchingRecords[0].radius;
}

export const SAFETY_RADIUS_RULES = [
  {
    id: 'rule_006',
    ruleType: 'DETECTION' as const,
    ruleName: '安全半径校验',
    condition: '点云日志中的半径值与安全半径表差值>5%',
    action: '标记为需人工确认，radius_source=MANUAL',
    codeReference: 'shared/rules/safetyRadiusRules.ts:20-45',
    description: '校验点云日志与安全半径表的可信度',
  },
];

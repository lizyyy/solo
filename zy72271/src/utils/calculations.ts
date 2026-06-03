import type { SafetyReport, RangefinderRecord } from '../types';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

export const calculateSafetyDistance = (
  recordId: string,
  rangefinderRecords: RangefinderRecord[],
  version: string = 'v1'
): SafetyReport => {
  const distances = rangefinderRecords.map(r => r.distance);
  const minDistance = Math.min(...distances);

  const requiredDistance = 10;

  const reflectionPoints = rangefinderRecords.length * 3;
  const soundPathLength = minDistance * 2;
  const decayRate = Number((1 / (soundPathLength * 0.1)).toFixed(4));

  const isSafe = minDistance >= requiredDistance;

  const warnings: string[] = [];

  if (!isSafe) {
    warnings.push(
      `最小距离 ${minDistance} 米小于安全距离要求 ${requiredDistance} 米`
    );
  }

  for (const record of rangefinderRecords) {
    if (record.hasBlockedWarning) {
      warnings.push('测距照片中存在告警标签被遮挡情况，已通过施工经理复核');
    }
    if (record.needsCorrection && record.originalDistance !== undefined) {
      warnings.push(
      `数据已从旧口径修正：${record.originalDistance} ${record.originalUnit} → ${record.distance} ${record.unit}`
      );
    }
  }

  return {
    id: generateId(),
    recordId,
    minDistance,
    requiredDistance,
    isSafe,
    warnings,
    generatedAt: new Date().toISOString(),
    version,
    calculationDetails: {
      reflectionPoints,
      soundPathLength,
      decayRate,
    },
  };
};

export const generateHistoryLog = (
  recordId: string,
  step: string,
  action: string,
  operator: string,
  details: string
) => {
  return {
    id: generateId(),
    recordId,
    step,
    action,
    operator,
    details,
    timestamp: new Date().toISOString(),
  };
};

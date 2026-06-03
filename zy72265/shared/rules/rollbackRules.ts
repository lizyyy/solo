import type { AuditLog, CoordinatePoint, ProcessingStatus } from '../types';

export function canRollback(
  currentStatus: ProcessingStatus,
  targetStatus: ProcessingStatus
): boolean {
  const statusOrder: ProcessingStatus[] = [
    'IMPORTED',
    'ENGINEER_REVIEW',
    'INSPECTION_REVIEW',
    'PUBLISHED',
  ];
  
  const currentIndex = statusOrder.indexOf(currentStatus);
  const targetIndex = statusOrder.indexOf(targetStatus);
  
  if (currentIndex === -1 || targetIndex === -1) {
    return false;
  }
  
  return targetIndex < currentIndex;
}

export function getRollbackTarget(
  auditLogs: AuditLog[],
  pointId: string
): {
  status: ProcessingStatus;
  xValue: number;
  yValue: number;
  safetyRadius: number | null;
  timestamp: string;
} | null {
  const pointLogs = auditLogs
    .filter(log => log.pointId === pointId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  if (pointLogs.length < 2) {
    return null;
  }
  
  const previousLog = pointLogs[1];
  
  if (!previousLog.originalValue) {
    return null;
  }
  
  try {
    const originalData = JSON.parse(previousLog.originalValue);
    return {
      status: originalData.status || 'IMPORTED',
      xValue: originalData.xValue || 0,
      yValue: originalData.yValue || 0,
      safetyRadius: originalData.safetyRadius || null,
      timestamp: previousLog.timestamp,
    };
  } catch {
    return null;
  }
}

export function serializePointState(point: CoordinatePoint): string {
  return JSON.stringify({
    xValue: point.xValue,
    yValue: point.yValue,
    status: point.status,
    safetyRadius: point.safetyRadius,
    coordinateType: point.coordinateType,
    isMixed: point.isMixed,
    radiusSource: point.radiusSource,
  });
}

export const ROLLBACK_RULES = [
  {
    id: 'rule_005',
    ruleType: 'ROLLBACK' as const,
    ruleName: '回滚规则',
    condition: '任一历史状态均可回滚',
    action: '恢复到指定历史状态，保留回滚审计记录',
    codeReference: 'shared/rules/rollbackRules.ts:10-40',
    description: '支持回滚到任一历史状态',
  },
];

export function getAllBoundaryRules() {
  return [
    ...ROLLBACK_RULES,
  ];
}

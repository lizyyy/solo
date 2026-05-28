import type { HistoryRecord, OperationType } from '../types';
import { generateId } from './calculator';

export function createHistoryRecord(
  pledgeId: string,
  operationType: OperationType,
  fieldName: string,
  beforeValue: string,
  afterValue: string,
  operator: string = '风控人员'
): HistoryRecord {
  return {
    id: generateId(),
    pledgeId,
    operationType,
    fieldName,
    beforeValue,
    afterValue,
    operator,
    operateTime: new Date().toISOString(),
  };
}

export function formatOperationType(type: OperationType): string {
  const labels: Record<OperationType, string> = {
    status_update: '状态更新',
    supplement: '补仓操作',
    extension: '展期操作',
    disposal: '处置操作',
    import: '数据导入',
  };
  return labels[type] || type;
}

export function getOperationTypeColor(type: OperationType): string {
  const colors: Record<OperationType, string> = {
    status_update: '#3b82f6',
    supplement: '#059669',
    extension: '#9333ea',
    disposal: '#dc2626',
    import: '#6b7280',
  };
  return colors[type] || '#6b7280';
}

export function compareValues(before: string, after: string): { changed: boolean; diff: string } {
  if (before === after) {
    return { changed: false, diff: '' };
  }

  const beforeNum = parseFloat(before);
  const afterNum = parseFloat(after);

  if (!isNaN(beforeNum) && !isNaN(afterNum)) {
    const diff = afterNum - beforeNum;
    const sign = diff > 0 ? '+' : '';
    return {
      changed: true,
      diff: `${sign}${diff.toFixed(2)}`,
    };
  }

  return {
    changed: true,
    diff: `${before} → ${after}`,
  };
}

export function getHistoryByPledge(
  history: HistoryRecord[],
  pledgeId: string
): HistoryRecord[] {
  return history
    .filter((h) => h.pledgeId === pledgeId)
    .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime());
}

export function getHistoryByOperationType(
  history: HistoryRecord[],
  operationType: OperationType
): HistoryRecord[] {
  return history
    .filter((h) => h.operationType === operationType)
    .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime());
}

export function getTodayHistory(history: HistoryRecord[]): HistoryRecord[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return history
    .filter((h) => new Date(h.operateTime) >= today)
    .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime());
}

export interface HistorySummary {
  totalOperations: number;
  byType: Record<OperationType, number>;
  todayOperations: number;
  lastOperationTime?: string;
}

export function getHistorySummary(history: HistoryRecord[]): HistorySummary {
  const byType: Record<OperationType, number> = {
    status_update: 0,
    supplement: 0,
    extension: 0,
    disposal: 0,
    import: 0,
  };

  history.forEach((h) => {
    byType[h.operationType] = (byType[h.operationType] || 0) + 1;
  });

  const todayOps = getTodayHistory(history);
  const sorted = [...history].sort(
    (a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime()
  );

  return {
    totalOperations: history.length,
    byType,
    todayOperations: todayOps.length,
    lastOperationTime: sorted[0]?.operateTime,
  };
}

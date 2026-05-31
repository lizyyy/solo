import type { HistoryRecord, HistoryAction, TargetType } from '@/types';
import { generateId } from '@/utils/timeUtils';

export function createHistoryRecord(
  action: HistoryAction,
  targetType: TargetType,
  targetId: string,
  beforeState: unknown,
  afterState: unknown,
  remark: string = '',
  operator: string = '当前用户'
): HistoryRecord {
  return {
    id: generateId(),
    action,
    targetType,
    targetId,
    beforeState,
    afterState,
    operator,
    remark,
    timestamp: new Date().toISOString()
  };
}

export function formatAction(action: HistoryAction): string {
  const labels: Record<HistoryAction, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    IMPORT: '导入',
    EXPORT: '导出',
    RESOLVE: '解决冲突'
  };
  return labels[action];
}

export function getActionColor(action: HistoryAction): string {
  const colors: Record<HistoryAction, string> = {
    CREATE: 'text-tech-green',
    UPDATE: 'text-tech-cyan',
    DELETE: 'text-tech-red',
    IMPORT: 'text-tech-orange',
    EXPORT: 'text-purple-400',
    RESOLVE: 'text-tech-green'
  };
  return colors[action];
}

export function filterHistory(
  records: HistoryRecord[],
  filters: {
    actions?: HistoryAction[];
    targetTypes?: TargetType[];
    startTime?: string;
    endTime?: string;
  }
): HistoryRecord[] {
  return records.filter(record => {
    if (filters.actions && !filters.actions.includes(record.action)) return false;
    if (filters.targetTypes && !filters.targetTypes.includes(record.targetType)) return false;
    if (filters.startTime && record.timestamp < filters.startTime) return false;
    if (filters.endTime && record.timestamp > filters.endTime) return false;
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getTargetTypeLabel(type: TargetType): string {
  const labels: Record<TargetType, string> = {
    WINDOW: '过境窗口',
    CONFLICT: '冲突记录',
    SETTINGS: '系统设置'
  };
  return labels[type];
}

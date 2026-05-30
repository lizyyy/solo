import { useMemo } from 'react';
import { OperationLog, OperationType } from '../types';
import { formatTime, getOperationTypeLabel } from '../utils/formatters';

export function useTimeline(operations: OperationLog[]) {
  const groupedOperations = useMemo(() => {
    const groups: {
      date: string;
      items: OperationLog[];
    }[] = [];

    let currentDate = '';
    let currentGroup: OperationLog[] = [];

    operations.forEach(op => {
      const opDate = new Date(op.timestamp).toLocaleDateString('zh-CN');
      if (opDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, items: currentGroup });
        }
        currentDate = opDate;
        currentGroup = [op];
      } else {
        currentGroup.push(op);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, items: currentGroup });
    }

    return groups;
  }, [operations]);

  const hasUnitErrors = useMemo(() => {
    return operations.some(op => op.actionType === OperationType.UNIT_ERROR_DETECTED);
  }, [operations]);

  const operationStats = useMemo(() => {
    return operations.reduce((acc, op) => {
      acc[op.actionType] = (acc[op.actionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [operations]);

  const formatOperationSummary = (op: OperationLog): string => {
    const typeLabel = getOperationTypeLabel(op.actionType);
    const time = formatTime(new Date(op.timestamp));
    return `[${time}] ${typeLabel}：${op.actionDetail}`;
  };

  const getOperationIcon = (type: OperationType): string => {
    const icons: Record<OperationType, string> = {
      [OperationType.BEARING_INPUT]: 'compass',
      [OperationType.BEARING_MODIFY]: 'edit-3',
      [OperationType.POSITION_MARK]: 'map-pin',
      [OperationType.POSITION_ADJUST]: 'move',
      [OperationType.ROUTE_SELECT]: 'route',
      [OperationType.SUBMIT]: 'send',
      [OperationType.UNIT_ERROR_DETECTED]: 'alert-triangle',
      [OperationType.REVIEW_APPROVE]: 'check-circle',
      [OperationType.REVIEW_RETURN]: 'rotate-ccw'
    };
    return icons[type] || 'circle';
  };

  return {
    groupedOperations,
    hasUnitErrors,
    operationStats,
    formatOperationSummary,
    getOperationIcon,
    totalOperations: operations.length
  };
}

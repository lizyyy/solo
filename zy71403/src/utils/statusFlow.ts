import type { RecordStatus, StatusOperation, OperationLog } from '../types';
import { STATUS_LABELS } from '../types';

export const STATUS_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  pending: ['processed', 'returned'],
  returned: ['pending', 'processed'],
  processed: [],
  anomaly: ['pending', 'returned'],
};

export const STATUS_OPERATIONS: Record<RecordStatus, StatusOperation[]> = {
  pending: [
    { label: '确认通过', action: 'approve', target: 'processed' },
    { label: '退回补材料', action: 'return', target: 'returned' },
  ],
  returned: [
    { label: '重新提交', action: 'resubmit', target: 'pending' },
    { label: '直接确认', action: 'force_approve', target: 'processed' },
  ],
  processed: [],
  anomaly: [
    { label: '解除异常', action: 'resolve', target: 'pending' },
    { label: '退回重录', action: 'reject', target: 'returned' },
  ],
};

export const STATUS_COLORS: Record<RecordStatus, { bg: string; text: string; border: string; dot: string }> = {
  processed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  returned: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  anomaly: {
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-300',
    dot: 'bg-rose-600',
  },
};

export function canTransition(from: RecordStatus, to: RecordStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) || false;
}

export function getAvailableOperations(status: RecordStatus): StatusOperation[] {
  return STATUS_OPERATIONS[status] || [];
}

export function getStatusLabel(status: RecordStatus): string {
  return STATUS_LABELS[status] || status;
}

export function getStatusColors(status: RecordStatus) {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
}

export function createOperationLog(
  valuationId: string,
  operator: string,
  operation: string,
  fromStatus: RecordStatus | null,
  toStatus: RecordStatus,
  remark: string = ''
): OperationLog {
  return {
    logId: `L${Date.now()}`,
    valuationId,
    operator,
    operation,
    fromStatus,
    toStatus,
    remark,
    operateTime: new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(/\//g, '-'),
  };
}

export interface TransitionResult {
  success: boolean;
  newStatus: RecordStatus | null;
  log: OperationLog | null;
  message: string;
}

export function executeStatusTransition(
  currentStatus: RecordStatus,
  targetStatus: RecordStatus,
  valuationId: string,
  operator: string,
  remark: string = ''
): TransitionResult {
  if (!canTransition(currentStatus, targetStatus)) {
    return {
      success: false,
      newStatus: null,
      log: null,
      message: `无法从"${getStatusLabel(currentStatus)}"转换到"${getStatusLabel(targetStatus)}"`,
    };
  }

  const operations = getAvailableOperations(currentStatus);
  const operation = operations.find(op => op.target === targetStatus);

  const log = createOperationLog(
    valuationId,
    operator,
    operation?.label || '状态变更',
    currentStatus,
    targetStatus,
    remark
  );

  return {
    success: true,
    newStatus: targetStatus,
    log,
    message: `已成功将状态从"${getStatusLabel(currentStatus)}"变更为"${getStatusLabel(targetStatus)}"`,
  };
}

export function getInitialStatusForAnomalies(hasError: boolean, hasWarning: boolean): RecordStatus {
  if (hasError) return 'anomaly';
  if (hasWarning) return 'pending';
  return 'processed';
}

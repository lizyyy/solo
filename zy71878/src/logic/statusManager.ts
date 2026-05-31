import type { DataRecord, RecordStatus, StatusChange } from '../types';
import { STATUS_LABELS } from '../types';

export const generateStatusChangeId = (): string => {
  return `sc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createStatusChange = (
  fromStatus: RecordStatus,
  toStatus: RecordStatus,
  reason: string,
  operator: string
): StatusChange => {
  return {
    id: generateStatusChangeId(),
    fromStatus,
    toStatus,
    reason,
    operator,
    timestamp: new Date().toISOString(),
  };
};

export const updateRecordStatus = (
  record: DataRecord,
  newStatus: RecordStatus,
  reason: string,
  operator: string
): DataRecord => {
  const statusChange = createStatusChange(
    record.status,
    newStatus,
    reason,
    operator
  );

  let anomalyReason = record.anomalyReason;
  if (newStatus === 'normal' || newStatus === 'corrected') {
    anomalyReason = undefined;
  }

  return {
    ...record,
    status: newStatus,
    anomalyReason,
    statusHistory: [...record.statusHistory, statusChange],
  };
};

export const getAllowedTransitions = (
  currentStatus: RecordStatus
): RecordStatus[] => {
  const transitions: Record<RecordStatus, RecordStatus[]> = {
    normal: ['corrected', 'pending', 'duplicate'],
    pending: ['normal', 'corrected', 'duplicate'],
    corrected: ['normal', 'pending', 'duplicate'],
    duplicate: ['normal', 'corrected', 'pending'],
  };
  return transitions[currentStatus];
};

export const getTransitionLabel = (
  fromStatus: RecordStatus,
  toStatus: RecordStatus
): string => {
  return `${STATUS_LABELS[fromStatus]} → ${STATUS_LABELS[toStatus]}`;
};

export const getPendingRecords = (records: DataRecord[]): DataRecord[] => {
  return records.filter(r => r.status === 'pending');
};

export const getRecordsByStatus = (
  records: DataRecord[],
  status: RecordStatus | 'all'
): DataRecord[] => {
  if (status === 'all') return records;
  return records.filter(r => r.status === status);
};

export const getAnomalySummary = (records: DataRecord[]): {
  total: number;
  byType: Record<string, number>;
} => {
  const pendingRecords = getPendingRecords(records);
  const byType: Record<string, number> = {};

  pendingRecords.forEach(r => {
    if (r.anomalyReason) {
      const type = r.anomalyReason.type;
      byType[type] = (byType[type] || 0) + 1;
    }
  });

  return {
    total: pendingRecords.length,
    byType,
  };
};

import { ExceptionRecord, Severity, GameRecord } from '../types';
import { generateId } from './curveGenerator';

export const addException = (
  exceptions: ExceptionRecord[],
  exception: ExceptionRecord
): ExceptionRecord[] => {
  return [...exceptions, exception];
};

export const confirmException = (
  exceptions: ExceptionRecord[],
  exceptionId: string,
  confirmedBy: string = 'player'
): ExceptionRecord[] => {
  return exceptions.map(e =>
    e.id === exceptionId
      ? {
          ...e,
          confirmed: true,
          confirmedBy,
          confirmedAt: Date.now(),
        }
      : e
  );
};

export const getUnconfirmedExceptions = (
  exceptions: ExceptionRecord[]
): ExceptionRecord[] => {
  return exceptions.filter(e => !e.confirmed);
};

export const getExceptionsByType = (
  exceptions: ExceptionRecord[],
  type: string
): ExceptionRecord[] => {
  return exceptions.filter(e => e.type === type);
};

export const getExceptionsByBatch = (
  exceptions: ExceptionRecord[],
  batchId: string
): ExceptionRecord[] => {
  return exceptions.filter(e => e.batchId === batchId);
};

export const getExceptionsBySeverity = (
  exceptions: ExceptionRecord[],
  severity: Severity
): ExceptionRecord[] => {
  return exceptions.filter(e => e.severity === severity);
};

export const getExceptionsByRecordId = (
  exceptions: ExceptionRecord[],
  recordId: string
): ExceptionRecord[] => {
  return exceptions.filter(e => e.recordId === recordId);
};

export const countExceptionsByType = (
  exceptions: ExceptionRecord[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  exceptions.forEach(e => {
    counts[e.type] = (counts[e.type] || 0) + 1;
  });
  return counts;
};

export const countExceptionsBySeverity = (
  exceptions: ExceptionRecord[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  exceptions.forEach(e => {
    counts[e.severity] = (counts[e.severity] || 0) + 1;
  });
  return counts;
};

export const hasUnconfirmedExceptions = (
  exceptions: ExceptionRecord[],
  batchId?: string
): boolean => {
  const filtered = batchId
    ? exceptions.filter(e => e.batchId === batchId)
    : exceptions;
  return filtered.some(e => !e.confirmed);
};

export const createExceptionFromRecord = (
  record: GameRecord,
  type: string,
  severity: Severity,
  description: string
): ExceptionRecord => {
  return {
    id: generateId('exc'),
    recordId: record.id,
    batchId: record.batchId,
    type: type as ExceptionRecord['type'],
    severity,
    description,
    position: { ...record.playerPosition },
    timestamp: Date.now(),
    confirmed: false,
  };
};

export const formatExceptionTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getSeverityLabel = (severity: Severity): string => {
  const labels: Record<Severity, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[severity];
};

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const generateId = (): string => {
  return uuidv4();
};

export const getCurrentTime = (): string => {
  return new Date().toISOString();
};

export const generateBatchNo = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BATCH-${dateStr}-${random}`;
};

export const generateReportNo = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REPORT-${dateStr}-${random}`;
};

export const calculateFileHash = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

export const calculateDeviation = (designed: number, actual: number): number => {
  return actual - designed;
};

export const calculateDeviationRate = (designed: number, actual: number): number => {
  if (designed === 0) return 0;
  return Math.round(((actual - designed) / designed) * 10000) / 100;
};

export const determineCheckLevel = (deviationRate: number): 'normal' | 'warning' | 'danger' => {
  const absRate = Math.abs(deviationRate);
  if (absRate <= 10) return 'normal';
  if (absRate <= 25) return 'warning';
  return 'danger';
};

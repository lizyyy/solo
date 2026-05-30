import dayjs from 'dayjs';
import { STATUS_LABELS, POINTS_DEVIATION_TOLERANCE } from './constants';

export const formatCurrency = (
  amount: number,
  currency: string = 'CNY',
  decimals: number = 2
): string => {
  const formatted = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return `${currency} ${formatted}`;
};

export const formatAmount = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatRate = (rate: number, decimals: number = 4): string => {
  return rate.toFixed(decimals);
};

export const formatPoints = (points: number): string => {
  const absPoints = Math.abs(points * 10000);
  const suffix = points >= 0 ? 'bp' : 'bp';
  return `${(points >= 0 ? '+' : '-')}${absPoints.toFixed(0)}${suffix}`;
};

export const formatDate = (date: Date | string): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

export const formatDateTime = (date: Date | string): string => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
};

export const formatStatus = (status: string): string => {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
};

export const getStatusColor = (status: string, colors: Record<string, string>): string => {
  return colors[status] || '#6B7280';
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const generateContractNo = (prefix: string = 'FWD'): string => {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${dateStr}-${random}`;
};

export const generateBatchNo = (): string => {
  const yearMonth = dayjs().format('YYYYMM');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BATCH-${yearMonth}-${random}`;
};

export const generateReportFileName = (batchNo: string): string => {
  const dateStr = dayjs().format('YYYYMMDD');
  return `外汇远期展期报告_${batchNo}_${dateStr}.xlsx`;
};

export const calculateDeviation = (calculated: number, actual: number): number => {
  return Math.abs(calculated - actual) * 10000;
};

export const isWithinTolerance = (deviation: number): boolean => {
  return deviation <= POINTS_DEVIATION_TOLERANCE;
};

export const formatValidationMessage = (
  contractNo: string,
  fieldName: string,
  errorReason: string,
  relatedMaterial: string,
  suggestion: string
): string => {
  return `[合约#${contractNo}] 字段[${fieldName}]：${errorReason}，涉及材料：${relatedMaterial}，建议操作：${suggestion}`;
};

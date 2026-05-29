import dayjs from 'dayjs';
import type { ApplicationStatus, ConflictType } from '@/types';
import { CONFLICT_DETAILS, STATUS_LABELS } from '@/types';

export const formatDate = (date: string | Date, format = 'YYYY-MM-DD'): string => {
  return dayjs(date).format(format);
};

export const formatDateTime = (date: string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string => {
  return dayjs(date).format(format);
};

export const formatNumber = (num: number, decimals = 0): string => {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatMoney = (num: number, decimals = 2): string => {
  return num.toLocaleString('zh-CN', {
    style: 'decimal',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const getStatusLabel = (status: ApplicationStatus): string => {
  return STATUS_LABELS[status] || status;
};

export const getStatusClass = (status: ApplicationStatus): string => {
  const classMap: Record<ApplicationStatus, string> = {
    pending: 'status-pending',
    confirmed: 'status-confirmed',
    exercised: 'status-exercised',
    withdrawn: 'status-withdrawn',
  };
  return classMap[status] || 'status-pending';
};

export const getConflictLabel = (type: ConflictType): string => {
  return CONFLICT_DETAILS[type]?.label || type;
};

export const getConflictClass = (type: ConflictType): string => {
  const classMap: Record<ConflictType, string> = {
    exercise_date_mismatch: 'conflict-date',
    withdrawn_still_in_list: 'conflict-withdrawn',
    insufficient_position: 'conflict-position',
  };
  return classMap[type] || 'conflict-date';
};

export const getConflictColor = (type: ConflictType): string => {
  return CONFLICT_DETAILS[type]?.color || '#e67e22';
};

export const generateId = (prefix = ''): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${timestamp}${random}`;
};

export const formatBondCode = (code: string): string => {
  if (code.length === 6) {
    return `${code.slice(0, 3)}.${code.slice(3)}`;
  }
  return code;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

export const isDateEqual = (date1: string, date2: string): boolean => {
  return dayjs(date1).isSame(dayjs(date2), 'day');
};

export const getDaysDiff = (date1: string, date2: string): number => {
  return dayjs(date1).diff(dayjs(date2), 'day');
};

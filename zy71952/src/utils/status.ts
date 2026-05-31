import type { RecordStatus, ChangeType, AnomalyType, Severity } from '../types';

export const statusConfig: Record<RecordStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  confirmed: {
    label: '已确认',
    color: 'text-status-confirmed',
    bgColor: 'bg-mono-100',
    borderColor: 'border-status-confirmed',
  },
  pending: {
    label: '待补',
    color: 'text-status-pending',
    bgColor: 'bg-amber-50',
    borderColor: 'border-status-pending',
  },
  modified: {
    label: '人工改过',
    color: 'text-status-modified',
    bgColor: 'bg-red-50',
    borderColor: 'border-status-modified',
  },
};

export const changeTypeConfig: Record<ChangeType, { label: string; color: string; bgColor: string }> = {
  create: {
    label: '创建',
    color: 'text-farm-600',
    bgColor: 'bg-farm-50',
  },
  supplement: {
    label: '补录',
    color: 'text-status-pending',
    bgColor: 'bg-amber-50',
  },
  modify: {
    label: '修改',
    color: 'text-status-modified',
    bgColor: 'bg-red-50',
  },
};

export const anomalyTypeConfig: Record<AnomalyType, { label: string; icon: string }> = {
  missing_return_point: {
    label: '返航点丢失',
    icon: '●',
  },
  delayed_note: {
    label: '备注延迟',
    icon: '⏰',
  },
  modified_photo: {
    label: '照片改动',
    icon: '✏️',
  },
  weather_mismatch: {
    label: '气象不匹配',
    icon: '☁️',
  },
};

export const severityConfig: Record<Severity | 'warning' | 'error', { label: string; color: string }> = {
  low: { label: '轻', color: 'text-farm-600' },
  medium: { label: '中', color: 'text-status-pending' },
  high: { label: '重', color: 'text-status-modified' },
  warning: { label: '警告', color: 'text-status-pending' },
  error: { label: '异常', color: 'text-status-modified' },
};

export const formatDateTime = (dateStr: string): string => {
  return dateStr;
};

export const formatDate = (dateStr: string): string => {
  return dateStr.split(' ')[0];
};

export const getTimeDiff = (start: string, end: string): number => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.round((e - s) / (1000 * 60 * 60) * 10) / 10;
};

export const cn = (...args: (string | boolean | undefined)[]): string => {
  return args.filter(Boolean).join(' ');
};

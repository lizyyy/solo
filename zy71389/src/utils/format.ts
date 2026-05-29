import { format as formatDate, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ContaminationType, ProcessStatus, FileType } from '../types';

export function formatTimestamp(timestamp: number, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return formatDate(timestamp, format, { locale: zhCN });
}

export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(timestamp, { addSuffix: true, locale: zhCN });
}

export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function getContaminationTypeColor(type: ContaminationType): string {
  switch (type) {
    case ContaminationType.CROSS_GROUP:
      return 'text-danger-600 bg-danger-50';
    case ContaminationType.DUPLICATE_EXPOSURE:
      return 'text-warning-600 bg-warning-50';
    case ContaminationType.CONFIG_CHANGE:
      return 'text-primary-600 bg-primary-50';
    case ContaminationType.NONE:
      return 'text-success-600 bg-success-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getContaminationTypeBgColor(type: ContaminationType): string {
  switch (type) {
    case ContaminationType.CROSS_GROUP:
      return 'bg-danger-500';
    case ContaminationType.DUPLICATE_EXPOSURE:
      return 'bg-warning-500';
    case ContaminationType.CONFIG_CHANGE:
      return 'bg-primary-500';
    case ContaminationType.NONE:
      return 'bg-success-500';
    default:
      return 'bg-gray-500';
  }
}

export function getProcessStatusColor(status: ProcessStatus): string {
  switch (status) {
    case ProcessStatus.PENDING:
      return 'text-gray-600 bg-gray-50';
    case ProcessStatus.PROCESSING:
      return 'text-primary-600 bg-primary-50';
    case ProcessStatus.COMPLETED:
      return 'text-success-600 bg-success-50';
    case ProcessStatus.ERROR:
      return 'text-danger-600 bg-danger-50';
    case ProcessStatus.SKIPPED:
      return 'text-warning-600 bg-warning-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getFileTypeIcon(type: FileType): string {
  switch (type) {
    case FileType.EXPERIMENT_CONFIG:
      return '⚙️';
    case FileType.USER_BUCKET:
      return '👥';
    case FileType.EXPOSURE_LOG:
      return '📊';
    case FileType.OPERATION_CHANGE:
      return '🔄';
    case FileType.CONVERSION_DATA:
      return '💰';
    case FileType.CONTAMINATION_REPORT:
      return '📋';
    default:
      return '📄';
  }
}

export function truncateString(str: string, maxLength: number = 50): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateChangePercent(oldValue: number, newValue: number): { value: number; isPositive: boolean } {
  if (oldValue === 0) return { value: 0, isPositive: true };
  const change = ((newValue - oldValue) / oldValue) * 100;
  return {
    value: Math.abs(change),
    isPositive: change >= 0
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m${seconds}s`;
}

export function formatCurrency(value: number, currency: string = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

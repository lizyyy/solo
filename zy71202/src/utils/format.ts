import dayjs from 'dayjs';

export const formatNumber = (num: number, decimals: number = 2): string => {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(decimals) + '亿';
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(decimals) + '万';
  }
  return num.toFixed(decimals);
};

export const formatPercent = (num: number, decimals: number = 2): string => {
  return (num * 100).toFixed(decimals) + '%';
};

export const formatMoney = (num: number, decimals: number = 2): string => {
  return '¥' + num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatDate = (date: string | Date, format: string = 'YYYY-MM-DD'): string => {
  return dayjs(date).format(format);
};

export const formatDateTime = (date: string | Date): string => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
};

export const formatRelativeTime = (date: string | Date): string => {
  const diff = dayjs().diff(dayjs(date), 'day');
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff}天前`;
  if (diff < 30) return `${Math.floor(diff / 7)}周前`;
  if (diff < 365) return `${Math.floor(diff / 30)}个月前`;
  return `${Math.floor(diff / 365)}年前`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    TRIGGERED: 'bg-danger-100 text-danger-800 border-danger-200',
    WARNING: 'bg-warning-100 text-warning-800 border-warning-200',
    NORMAL: 'bg-success-100 text-success-800 border-success-200',
    GAP: 'bg-slate-100 text-slate-800 border-slate-200',
    VALID: 'bg-success-100 text-success-800',
    UPDATED: 'bg-warning-100 text-warning-800',
    WITHDRAWN: 'bg-danger-100 text-danger-800',
    NONE: 'bg-slate-100 text-slate-500',
    HIGH: 'bg-danger-100 text-danger-800',
    MEDIUM: 'bg-warning-100 text-warning-800',
    LOW: 'bg-slate-100 text-slate-600',
    PENDING_CONFIRM: 'bg-warning-100 text-warning-800',
    PROCESSING: 'bg-primary-100 text-primary-800',
    PROCESSED: 'bg-success-100 text-success-800',
    RETURNED: 'bg-danger-100 text-danger-800',
    SENT: 'bg-success-100 text-success-800',
    FAILED: 'bg-danger-100 text-danger-800',
    PENDING: 'bg-warning-100 text-warning-800',
    CANCELLED: 'bg-slate-100 text-slate-500',
  };
  return colorMap[status] || 'bg-slate-100 text-slate-600';
};

export const getStatusBadgeClass = (status: string): string => {
  const baseClass = 'badge';
  const colorMap: Record<string, string> = {
    TRIGGERED: 'badge-danger',
    WARNING: 'badge-warning',
    NORMAL: 'badge-success',
    GAP: 'badge-secondary',
    VALID: 'badge-success',
    UPDATED: 'badge-warning',
    WITHDRAWN: 'badge-danger',
    NONE: 'badge-secondary',
    HIGH: 'badge-danger',
    MEDIUM: 'badge-warning',
    LOW: 'badge-secondary',
    PENDING_CONFIRM: 'badge-warning',
    PROCESSING: 'badge-info',
    PROCESSED: 'badge-success',
    RETURNED: 'badge-danger',
    SENT: 'badge-success',
    FAILED: 'badge-danger',
    PENDING: 'badge-warning',
    CANCELLED: 'badge-secondary',
  };
  return `${baseClass} ${colorMap[status] || 'badge-secondary'}`;
};

export const generateChartColors = (count: number): string[] => {
  const baseColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];
  return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

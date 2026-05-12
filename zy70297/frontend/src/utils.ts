import { ProblemType, RectificationStatus } from './types';

export const problemTypeLabels: Record<ProblemType, string> = {
  hose: '软管',
  alarm: '报警器',
  valve: '阀门',
};

export const problemTypeColors: Record<ProblemType, string> = {
  hose: '#dc2626',
  alarm: '#d97706',
  valve: '#2563eb',
};

export const rectificationDays: Record<ProblemType, number> = {
  hose: 3,
  alarm: 5,
  valve: 7,
};

export const statusLabels: Record<RectificationStatus, string> = {
  created: '待整改',
  scheduled_review: '待复查',
  review_failed: '复查不通过',
  gas_cut_off: '已停气',
  completed: '已完成',
};

export const statusColors: Record<RectificationStatus, string> = {
  created: '#ef4444',
  scheduled_review: '#f59e0b',
  review_failed: '#f97316',
  gas_cut_off: '#dc2626',
  completed: '#22c55e',
};

export const merchantStatusLabels: Record<string, string> = {
  normal: '正常',
  warning: '整改中',
  gas_cut_off: '已停气',
};

export const merchantStatusColors: Record<string, string> = {
  normal: '#22c55e',
  warning: '#f59e0b',
  gas_cut_off: '#dc2626',
};

export const severityLabels: Record<string, string> = {
  critical: '危急',
  major: '重要',
  minor: '一般',
};

export const severityColors: Record<string, string> = {
  critical: '#dc2626',
  major: '#f97316',
  minor: '#f59e0b',
};

export const priorityLabels: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const priorityColors: Record<string, string> = {
  urgent: '#dc2626',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
};

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDaysUntilDeadline(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diff = deadlineDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

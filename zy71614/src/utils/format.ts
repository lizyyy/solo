import type { TaskStatus, RecordStatus } from '@/types';

export function formatCurrency(amount: number): string {
  return '¥' + amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(date: string): string {
  if (!date) return '';
  return date.slice(0, 10);
}

export function formatPercent(ratio: number): string {
  return (ratio * 100).toFixed(1) + '%';
}

const taskStatusLabels: Record<TaskStatus, string> = {
  draft: '草稿',
  processing: '进行中',
  pending_material: '待补材料',
  completed: '已完成',
  cancelled: '已取消',
};

export function getStatusLabel(status: TaskStatus): string {
  return taskStatusLabels[status] || status;
}

export function getStatusColor(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    processing: 'bg-blue-100 text-blue-700',
    pending_material: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-zinc-100 text-zinc-600';
}

const recordStatusLabels: Record<RecordStatus, string> = {
  normal: '正常',
  warning: '警告',
  error: '异常',
};

export function getRecordStatusLabel(status: RecordStatus): string {
  return recordStatusLabels[status] || status;
}

export function getRecordStatusColor(status: RecordStatus): string {
  const map: Record<RecordStatus, string> = {
    normal: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-zinc-100 text-zinc-600';
}

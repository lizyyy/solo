import { RecordStatus } from '@/types';

export const statusLabels: Record<RecordStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  to_supplement: '待补充',
  modified: '已修改',
};

export const statusColors: Record<RecordStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  to_supplement: 'bg-red-100 text-red-800',
  modified: 'bg-blue-100 text-blue-800',
};

export const statusColorsBg: Record<RecordStatus, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-green-500',
  to_supplement: 'bg-red-500',
  modified: 'bg-blue-500',
};

export function getStatusLabel(status: RecordStatus): string {
  return statusLabels[status];
}

export function getStatusColor(status: RecordStatus): string {
  return statusColors[status];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export const STATUS_OPTIONS = [
  { value: 'PENDING', label: '待处理', color: 'orange' },
  { value: 'IN_PROGRESS', label: '处理中', color: 'processing' },
  { value: 'COMPLETED', label: '已完成', color: 'success' },
  { value: 'CANCELLED', label: '已取消', color: 'default' },
  { value: 'REOPENED', label: '重新开启', color: 'blue' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: '低', color: 'default' },
  { value: 'MEDIUM', label: '中', color: 'blue' },
  { value: 'HIGH', label: '高', color: 'orange' },
  { value: 'URGENT', label: '紧急', color: 'red' },
] as const;

export const ACTION_OPTIONS = [
  { value: 'CREATE', label: '创建' },
  { value: 'UPDATE', label: '更新' },
  { value: 'DELETE', label: '删除' },
  { value: 'ROLLBACK', label: '回滚' },
  { value: 'LOCK', label: '锁定' },
  { value: 'UNLOCK', label: '解锁' },
  { value: 'EXPORT', label: '导出' },
];

export const getStatusInfo = (status: string) => {
  return STATUS_OPTIONS.find((s) => s.value === status) || { label: status, color: 'default' };
};

export const getPriorityInfo = (priority: string) => {
  return PRIORITY_OPTIONS.find((p) => p.value === priority) || { label: priority, color: 'default' };
};

export const getActionLabel = (action: string) => {
  return ACTION_OPTIONS.find((a) => a.value === action)?.label || action;
};

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
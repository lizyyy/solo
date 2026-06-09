import type { ScheduleStatus, ChangeType } from '../types/schedule';

// 格式化 ISO 时间字符串为 YYYY-MM-DD HH:mm
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

// 将 ScheduleStatus 转换为中文状态名
export function formatStatus(status: ScheduleStatus): string {
  const map: Record<ScheduleStatus, string> = {
    confirmed: '已确认',
    pending: '待确认',
    withdrawn: '已撤回',
    draft: '草稿',
  };
  return map[status];
}

// 根据状态返回 Tailwind 颜色类（包含 bg、text、border）
export function statusColor(status: ScheduleStatus): {
  bg: string;
  text: string;
  border: string;
} {
  const map: Record<
    ScheduleStatus,
    { bg: string; text: string; border: string }
  > = {
    confirmed: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
    },
    pending: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
    },
    withdrawn: {
      bg: 'bg-gray-50',
      text: 'text-gray-600',
      border: 'border-gray-200',
    },
    draft: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
  };
  return map[status];
}

// 将 ChangeType 转换为中文变更类型名
export function changeTypeLabel(type: ChangeType): string {
  const map: Record<ChangeType, string> = {
    create: '创建',
    update: '更新',
    withdraw: '撤回',
    confirm: '确认',
    reject: '驳回',
    resubmit: '重新提交',
    model_replace: '机型替换',
  };
  return map[type];
}

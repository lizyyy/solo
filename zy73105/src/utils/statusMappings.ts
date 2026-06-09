import type { ConclusionStatus, FilterTab, ResolutionDirection, ResolutionStatus } from '../types/review';

export const STATUS_LABEL: Record<ConclusionStatus, string> = {
  confirmed: '已确认',
  'pending-material': '待补件',
  returned: '退回',
  draft: '草稿',
};

export const STATUS_BADGE_CLASS: Record<ConclusionStatus, string> = {
  confirmed: 'bg-status-confirmed-bg text-status-confirmed border-status-confirmed/30',
  'pending-material': 'bg-status-pending-bg text-status-pending border-status-pending/30',
  returned: 'bg-status-returned-bg text-status-returned border-status-returned/30',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const STATUS_DOT_CLASS: Record<ConclusionStatus, string> = {
  confirmed: 'bg-status-confirmed',
  'pending-material': 'bg-status-pending',
  returned: 'bg-status-returned',
  draft: 'bg-slate-400',
};

export const FILTER_LABEL: Record<FilterTab, string> = {
  all: '全部',
  confirmed: '已确认',
  'pending-material': '待补件',
  returned: '退回',
  'late-attachment': '含晚到附件',
  'layer-issue': '图层异常',
};

export const RESOLUTION_DIRECTION_LABEL: Record<ResolutionDirection, string> = {
  rename: '重命名处理',
  return: '退回设计方',
  hold: '暂挂等待',
};

export const RESOLUTION_DIRECTION_CLASS: Record<ResolutionDirection, string> = {
  rename: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  return: 'bg-rose-50 text-rose-700 border-rose-200',
  hold: 'bg-sky-50 text-sky-700 border-sky-200',
};

export const RESOLUTION_STATUS_LABEL: Record<ResolutionStatus, string> = {
  pending: '待处理',
  done: '已处理',
};

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

export function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function hasLateAttachment(attachments: { isLate: boolean }[]): boolean {
  return attachments.some((a) => a.isLate);
}

export function hasLayerIssue(layerIssues: unknown[]): boolean {
  return layerIssues.length > 0;
}

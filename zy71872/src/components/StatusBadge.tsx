import type { SubmissionStatus, WindowStatus } from '../types';

interface StatusBadgeProps {
  status: SubmissionStatus | WindowStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  queued: { label: '排队中', color: 'text-slate-300 bg-slate-800 border-slate-600', dotColor: 'bg-slate-400' },
  processing: { label: '处理中', color: 'text-amber-300 bg-amber-900/30 border-amber-600/50', dotColor: 'bg-amber-500 animate-pulse' },
  success: { label: '已完成', color: 'text-emerald-300 bg-emerald-900/30 border-emerald-600/50', dotColor: 'bg-emerald-500' },
  failed: { label: '失败', color: 'text-red-300 bg-red-900/30 border-red-600/50', dotColor: 'bg-red-500' },
  idle: { label: '空闲', color: 'text-slate-400 bg-slate-800 border-slate-600', dotColor: 'bg-slate-500' },
  busy: { label: '忙碌', color: 'text-amber-300 bg-amber-900/30 border-amber-600/50', dotColor: 'bg-amber-500' },
  paused: { label: '暂停', color: 'text-blue-300 bg-blue-900/30 border-blue-600/50', dotColor: 'bg-blue-500' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.queued;
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs';

  return (
    <span className={`badge ${config.color} ${sizeClass}`}>
      <span className={`status-dot ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

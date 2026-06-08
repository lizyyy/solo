import type { ReviewStatus, ExceptionType } from '../../shared/types.js';

const statusMap: Record<ReviewStatus, { label: string; cls: string }> = {
  pending: { label: '待复核', cls: 'bg-accent-300/25 text-accent-500 border-accent-300/60' },
  approved: { label: '复核通过', cls: 'bg-brand-100 text-brand-700 border-brand-300/60' },
  exception: { label: '存在异常', cls: 'bg-warn-400/20 text-warn-500 border-warn-400/60' },
  needsInfo: { label: '需补充信息', cls: 'bg-warn-400/15 text-warn-600 border-warn-400/50' },
};

export function StatusBadge({ status, size = 'md' }: { status: ReviewStatus; size?: 'sm' | 'md' }) {
  const cfg = statusMap[status];
  const sz = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`chip border ${cfg.cls} ${sz}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'approved' ? 'bg-brand-500' : status === 'exception' ? 'bg-warn-500' : status === 'needsInfo' ? 'bg-warn-400' : 'bg-accent-400'}`} />
      {cfg.label}
    </span>
  );
}

const excMap: Record<ExceptionType, { label: string; cls: string; icon: string }> = {
  weight: { label: '体重异常', cls: 'bg-warn-400/15 text-warn-600', icon: '📉' },
  vaccine: { label: '疫苗缺失', cls: 'bg-warn-500/15 text-warn-600', icon: '💉' },
  photo: { label: '照片异常', cls: 'bg-accent-300/30 text-accent-500', icon: '🖼️' },
  verbal: { label: '口头备注', cls: 'bg-brand-100 text-brand-700', icon: '💬' },
  withdrawn: { label: '撤回记录', cls: 'bg-ink-100 text-ink-500', icon: '↩️' },
};

export function ExceptionTypeBadge({ type }: { type: ExceptionType }) {
  const cfg = excMap[type];
  return (
    <span className={`chip ${cfg.cls} border border-transparent`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

export function AnomalyBadge({ kind }: { kind: 'weight' | 'vaccine' | 'photo' | 'supplement' }) {
  const cfg = {
    weight: { label: '体重异常', cls: 'bg-warn-500/15 text-warn-600 ring-warn-400/40 animate-pulse-soft' },
    vaccine: { label: '疫苗缺失', cls: 'bg-warn-600/15 text-warn-500 ring-warn-500/40 animate-pulse-soft' },
    photo: { label: '照片异常', cls: 'bg-accent-300/30 text-accent-500 ring-accent-300/40' },
    supplement: { label: '补录备注', cls: 'bg-brand-100 text-brand-700 ring-brand-300/40' },
  }[kind];
  return <span className={`chip ring-1 ring-inset ${cfg.cls}`}>{cfg.label}</span>;
}

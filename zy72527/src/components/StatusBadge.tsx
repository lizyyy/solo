import { AlertTriangle, CheckCircle, Clock, ShieldAlert, XCircle } from 'lucide-react';
import type { ManifestStatus } from '../types';
import { cn } from '../lib/utils';

interface StatusBadgeProps {
  status: ManifestStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<ManifestStatus, { label: string; bg: string; text: string; icon: typeof AlertTriangle }> = {
  pending: {
    label: '待处理',
    bg: 'bg-zinc-700/50',
    text: 'text-zinc-400',
    icon: Clock,
  },
  processing: {
    label: '处理中',
    bg: 'bg-blue-900/30',
    text: 'text-blue-400',
    icon: Clock,
  },
  conflict: {
    label: '存在冲突',
    bg: 'bg-amber-900/30',
    text: 'text-amber-400',
    icon: AlertTriangle,
  },
  overridden: {
    label: '改判被覆盖',
    bg: 'bg-rose-900/30',
    text: 'text-rose-400',
    icon: ShieldAlert,
  },
  verified: {
    label: '已复核',
    bg: 'bg-emerald-900/30',
    text: 'text-emerald-400',
    icon: CheckCircle,
  },
  completed: {
    label: '已完成',
    bg: 'bg-emerald-900/30',
    text: 'text-emerald-400',
    icon: CheckCircle,
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-medium',
        size === 'sm' ? 'text-xs' : 'text-sm',
        config.bg,
        config.text,
        status === 'conflict' && 'animate-pulse',
        status === 'overridden' && 'animate-pulse'
      )}
    >
      <Icon size={iconSize} />
      {config.label}
    </span>
  );
}

interface SourceBadgeProps {
  source: 'ocr' | 'knowledge_base' | 'ticket' | 'manual';
}

const sourceConfig = {
  ocr: { label: 'OCR识别', bg: 'bg-zinc-700/60', text: 'text-zinc-300' },
  knowledge_base: { label: '知识库', bg: 'bg-indigo-900/40', text: 'text-indigo-300' },
  ticket: { label: '线上工单', bg: 'bg-pink-900/40', text: 'text-pink-300' },
  manual: { label: '人工改判', bg: 'bg-orange-900/40', text: 'text-orange-300' },
};

export function SourceBadge({ source }: SourceBadgeProps) {
  const config = sourceConfig[source];
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', config.bg, config.text)}>
      {config.label}
    </span>
  );
}

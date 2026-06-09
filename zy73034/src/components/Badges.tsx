import { AlertTriangle, Scale, Clock, History, Shuffle } from 'lucide-react';
import type { Anomaly } from '@/types';

const COLOR_MAP: Record<Anomaly['type'], string> = {
  alias_duplicate: 'bg-clay-100 text-clay-600 border-clay-300',
  self_alias_duplicate: 'bg-clay-100 text-clay-600 border-clay-300',
  manual_rejudge: 'bg-sage-100 text-sage-700 border-sage-300',
  pending_confirm: 'bg-amber-50 text-amber-700 border-amber-300',
  conflict_history: 'bg-rose-50 text-rose-700 border-rose-300',
};

const ICON_MAP: Record<Anomaly['type'], React.ElementType> = {
  alias_duplicate: Shuffle,
  self_alias_duplicate: AlertTriangle,
  manual_rejudge: Scale,
  pending_confirm: Clock,
  conflict_history: History,
};

export function AnomalyBadge({ anomaly, compact = false }: { anomaly: Anomaly; compact?: boolean }) {
  const Icon = ICON_MAP[anomaly.type];
  const color = COLOR_MAP[anomaly.type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${color} ${
        compact ? '' : 'shadow-sm'
      }`}
      title={anomaly.message}
    >
      <Icon className="h-3 w-3" />
      <span>{compact ? anomaly.typeLabel : anomaly.message}</span>
    </span>
  );
}

declare module '@/types' {
  interface Anomaly {
    typeLabel?: string;
  }
}

export function anomalyTypeLabel(t: Anomaly['type']): string {
  switch (t) {
    case 'alias_duplicate':
      return '别名冲突';
    case 'self_alias_duplicate':
      return '别名自重复';
    case 'manual_rejudge':
      return '人工改判';
    case 'pending_confirm':
      return '待确认';
    case 'conflict_history':
      return '版本冲突';
  }
}

export function ProgressLabel({ progress }: { progress: '未开始' | '进行中' | '已完成' | '中止' }) {
  const map: Record<string, string> = {
    未开始: 'bg-slate-100 text-slate-600 border-slate-300',
    进行中: 'bg-sky-50 text-sky-700 border-sky-300',
    已完成: 'bg-sage-100 text-sage-700 border-sage-300',
    中止: 'bg-rose-50 text-rose-700 border-rose-300',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${map[progress]}`}>
      {progress}
    </span>
  );
}

export function JudgeLabel({ judge }: { judge: '合格' | '不合格' | '待评定' }) {
  const map: Record<string, string> = {
    合格: 'bg-sage-100 text-sage-800 border-sage-400',
    不合格: 'bg-rose-50 text-rose-800 border-rose-300',
    待评定: 'bg-amber-50 text-amber-800 border-amber-300',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${map[judge]}`}>
      {judge}
    </span>
  );
}

import { cn } from '@/lib/utils';
import type { SummaryStats } from '@/types';
import { FileCheck, FileX2, ListTodo, AlertCircle, ClipboardList } from 'lucide-react';

type StatKey = 'total' | 'confirmed' | 'awaitingPatch' | 'reverted' | 'pending';

const STAT_CONFIG: Record<StatKey, {
  label: string;
  accent: string;
  ring: string;
  iconBg: string;
  icon: typeof ClipboardList;
}> = {
  total: {
    label: '交底总数',
    accent: 'text-slate-900',
    ring: 'ring-slate-200',
    iconBg: 'bg-slate-100 text-slate-700',
    icon: ClipboardList,
  },
  pending: {
    label: '待确认',
    accent: 'text-amber-700',
    ring: 'ring-amber-200',
    iconBg: 'bg-amber-100 text-amber-700',
    icon: ListTodo,
  },
  confirmed: {
    label: '已确认',
    accent: 'text-emerald-700',
    ring: 'ring-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-700',
    icon: FileCheck,
  },
  awaitingPatch: {
    label: '待补件',
    accent: 'text-orange-700',
    ring: 'ring-orange-200',
    iconBg: 'bg-orange-100 text-orange-700',
    icon: AlertCircle,
  },
  reverted: {
    label: '退回记录',
    accent: 'text-rose-700',
    ring: 'ring-rose-200',
    iconBg: 'bg-rose-100 text-rose-700',
    icon: FileX2,
  },
};

export function SummaryPanel({ summary }: { summary: SummaryStats }) {
  const order: StatKey[] = ['total', 'pending', 'confirmed', 'awaitingPatch', 'reverted'];
  const values: Record<StatKey, number> = {
    total: summary.total,
    pending: summary.pending,
    confirmed: summary.confirmed,
    awaitingPatch: summary.awaitingPatch,
    reverted: summary.reverted,
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {order.map((key) => {
        const cfg = STAT_CONFIG[key];
        const Icon = cfg.icon;
        const val = values[key];
        const pct = summary.total === 0 ? 0 : Math.round((val / summary.total) * 100);
        return (
          <div
            key={key}
            className={cn(
              'group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md'
            )}
          >
            <div className="flex items-start justify-between">
              <div className={cn('rounded-lg p-2', cfg.iconBg)}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {summary.total > 0 && key !== 'total' ? `${pct}%` : ''}
              </span>
            </div>
            <div className="mt-3">
              <div
                className={cn(
                  'font-mono text-3xl font-bold tabular-nums tracking-tight',
                  cfg.accent
                )}
              >
                {val}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">{cfg.label}</div>
            </div>
            <div
              className={cn(
                'absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r opacity-40',
                key === 'total' && 'from-slate-400 to-slate-300',
                key === 'pending' && 'from-amber-400 to-amber-300',
                key === 'confirmed' && 'from-emerald-400 to-emerald-300',
                key === 'awaitingPatch' && 'from-orange-400 to-orange-300',
                key === 'reverted' && 'from-rose-400 to-rose-300'
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

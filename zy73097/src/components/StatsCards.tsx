import { FileText, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { useStats, useMaterialStore } from '../store';
import type { MaterialStatus } from '../types';
import { cn } from '../lib/utils';

const ITEMS = [
  {
    key: 'total',
    label: '筛选后总数',
    icon: FileText,
    color: 'text-navy-500',
    bg: 'bg-navy-50 border-navy-200',
    filter: null as MaterialStatus | null,
  },
  {
    key: 'confirmed',
    label: '已确认',
    icon: CheckCircle2,
    color: 'text-confirm-700',
    bg: 'bg-confirm-50 border-confirm-300',
    filter: 'CONFIRMED',
  },
  {
    key: 'pending',
    label: '待补件',
    icon: Clock,
    color: 'text-pending-700',
    bg: 'bg-pending-50 border-pending-300',
    filter: 'PENDING',
  },
  {
    key: 'rejected',
    label: '退回',
    icon: XCircle,
    color: 'text-reject-700',
    bg: 'bg-reject-50 border-reject-300',
    filter: 'REJECTED',
  },
  {
    key: 'abnormal',
    label: '图层异常未复核',
    icon: AlertTriangle,
    color: 'text-fire-700',
    bg: 'bg-fire-50 border-fire-300 bg-stripe-red',
    filter: '__abnormal__',
  },
] as const;

export function StatsCards() {
  const stats = useStats();
  const filters = useMaterialStore((s) => s.filters);
  const setFilters = useMaterialStore((s) => s.setFilters);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {ITEMS.map((it) => {
        const v = stats[it.key as keyof typeof stats];
        const isActive =
          (it.filter === '__abnormal__' && filters.hasAbnormality === true) ||
          (it.filter !== '__abnormal__' && it.filter !== null && filters.status === it.filter) ||
          (it.filter === null &&
            !filters.status &&
            filters.hasAbnormality === null &&
            Object.entries(filters).every(
              ([k, v]) =>
                ['keyword', 'fireZone', 'type', 'dateFrom', 'dateTo'].includes(k) || v === null || v === '',
            ));
        return (
          <button
            key={it.key}
            onClick={() => {
              if (it.filter === '__abnormal__') {
                setFilters({ hasAbnormality: filters.hasAbnormality === true ? null : true });
              } else {
                setFilters({ status: filters.status === it.filter ? null : it.filter });
              }
            }}
            className={cn(
              'card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg',
              'border-2',
              it.bg,
              isActive && 'ring-2 ring-navy-500',
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-ink-500">{it.label}</div>
                <div className={cn('mt-2 font-mono font-bold tabular-nums text-3xl', it.color)}>
                  {v}
                </div>
              </div>
              <div className={cn('p-2 rounded bg-white/80 border border-white', it.color)}>
                <it.icon size={20} />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-ink-500 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink-300" />
              点击联动筛选
            </div>
          </button>
        );
      })}
    </div>
  );
}

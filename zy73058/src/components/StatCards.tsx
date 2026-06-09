import { useReviewStore } from '@/store/reviewStore';
import type { ReviewStatus } from '@/types';
import { CheckCircle, Clock, XCircle, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

const tabs: Array<{
  key: ReviewStatus | 'all';
  label: string;
  countKey: 'confirmed' | 'pending' | 'rejected' | null;
  cls: string;
  borderCls: string;
  Icon: typeof CheckCircle;
}> = [
  {
    key: 'pending',
    label: '待补件',
    countKey: 'pending',
    cls: 'from-amber-50 to-amber-100 text-amber-900',
    borderCls: 'border-l-4 border-amber-500',
    Icon: Clock,
  },
  {
    key: 'confirmed',
    label: '已确认',
    countKey: 'confirmed',
    cls: 'from-emerald-50 to-emerald-100 text-emerald-900',
    borderCls: 'border-l-4 border-emerald-600',
    Icon: CheckCircle,
  },
  {
    key: 'rejected',
    label: '退回',
    countKey: 'rejected',
    cls: 'from-red-50 to-red-100 text-red-900',
    borderCls: 'border-l-4 border-red-600',
    Icon: XCircle,
  },
];

export function StatCards() {
  const { statusFilter, setStatusFilter, getStatusCounts } = useReviewStore();
  const counts = getStatusCounts();

  return (
    <div className="grid grid-cols-3 gap-4">
      {tabs.map((t) => {
        const count = t.countKey ? counts[t.countKey] : 0;
        const active = statusFilter === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setStatusFilter(active ? 'all' : t.key)}
            className={clsx(
              'group relative text-left p-5 rounded border bg-gradient-to-br transition-all duration-200',
              t.cls,
              t.borderCls,
              active ? 'ring-2 ring-blue-700 shadow-lg -translate-y-0.5' : 'hover:shadow-md hover:-translate-y-0.5',
              'border-zinc-300'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold opacity-80">
                  <t.Icon className="w-4 h-4" />
                  {t.label}
                </div>
                <div className="mt-3 text-4xl font-bold tracking-tight" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {count}
                </div>
                <div className="mt-1 text-[11px] opacity-70">条复核记录</div>
              </div>
              <ChevronDown
                className={clsx(
                  'w-5 h-5 mt-1 transition-transform duration-200 opacity-60',
                  active && 'rotate-180 opacity-100'
                )}
              />
            </div>
            <div className="mt-4 text-[11px] font-medium px-2 py-1 rounded bg-white/60 inline-block border border-white/80">
              {active ? '✅ 已筛选，再次点击取消' : '点击按此状态筛选'}
            </div>
          </button>
        );
      })}
    </div>
  );
}

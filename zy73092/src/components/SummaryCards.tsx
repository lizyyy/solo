import type { SummaryStat, MaterialStatus } from '@/shared/types';
import { useTrackerStore } from '@/store/useTrackerStore';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  data: SummaryStat;
}

interface CardConfig {
  key: keyof Omit<SummaryStat, 'bySpecialty' | 'total'>;
  label: string;
  statusFilter: MaterialStatus;
  gradient: string;
  accent: string;
  icon: string;
}

const cardConfigs: CardConfig[] = [
  {
    key: 'processed',
    label: '已处理',
    statusFilter: 'PROCESSED',
    gradient: 'from-emerald-500 to-emerald-600',
    accent: 'bg-emerald-400/30',
    icon: '✓',
  },
  {
    key: 'pending',
    label: '待改判',
    statusFilter: 'PENDING',
    gradient: 'from-amber-500 to-amber-600',
    accent: 'bg-amber-400/30',
    icon: '⟳',
  },
  {
    key: 'suspended',
    label: '挂起中',
    statusFilter: 'SUSPENDED',
    gradient: 'from-rose-500 to-rose-600',
    accent: 'bg-rose-400/30',
    icon: '⏸',
  },
  {
    key: 'missing',
    label: '缺材料',
    statusFilter: 'MISSING',
    gradient: 'from-orange-500 to-orange-600',
    accent: 'bg-orange-400/30',
    icon: '⚠',
  },
  {
    key: 'awaitingPm',
    label: '待PM确认',
    statusFilter: 'AWAITING_PM',
    gradient: 'from-violet-500 to-violet-600',
    accent: 'bg-violet-400/30',
    icon: '→',
  },
];

export default function SummaryCards({ data }: SummaryCardsProps) {
  const setFilter = useTrackerStore((s) => s.setFilter);
  const currentFilter = useTrackerStore((s) => s.filter);

  const handleCardClick = (status: MaterialStatus) => {
    setFilter({ status: currentFilter.status === status ? 'ALL' : status });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
      {cardConfigs.map((config) => {
        const value = data[config.key] as number;
        const isActive = currentFilter.status === config.statusFilter;
        return (
          <button
            key={config.key}
            onClick={() => handleCardClick(config.statusFilter)}
            className={cn(
              'relative overflow-hidden rounded-xl p-5 text-left transition-all duration-200',
              'bg-gradient-to-br text-white shadow-md',
              'hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
              'ring-2',
              isActive ? 'ring-white/60 scale-[1.02]' : 'ring-transparent',
              config.gradient
            )}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white/90">{config.label}</span>
                <span className="text-lg opacity-70">{config.icon}</span>
              </div>
              <div className="text-3xl font-bold tracking-tight">{value}</div>
              <div className="mt-2 text-xs text-white/70">占总数 {data.total ? ((value / data.total) * 100).toFixed(0) : 0}%</div>
            </div>
            <div
              className={cn(
                'absolute -right-8 -bottom-8 w-32 h-32 rotate-45',
                config.accent
              )}
            />
            <div
              className={cn(
                'absolute right-0 bottom-0 w-0 h-0',
                'border-l-[80px] border-b-[80px]',
                'border-l-transparent',
                'border-b-white/10'
              )}
            />
          </button>
        );
      })}

      <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/90">材料总数</span>
            <span className="text-lg opacity-70">Σ</span>
          </div>
          <div className="text-3xl font-bold tracking-tight">{data.total}</div>
          <div className="mt-2 text-xs text-white/70">4 专业分类</div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 rotate-45 bg-slate-400/30" />
        <div className="absolute right-0 bottom-0 w-0 h-0 border-l-[80px] border-b-[80px] border-l-transparent border-b-white/10" />
      </div>
    </div>
  );
}

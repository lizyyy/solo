import { CheckCircle2, PackageOpen, RotateCcw, ClipboardList } from 'lucide-react';
import { useReconciliationStore } from '../store/useReconciliationStore';
import type { StatusFilter } from '../types/reconciliation';

interface CardDef {
  key: StatusFilter | 'total';
  label: string;
  Icon: typeof CheckCircle2;
  border: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  numberColor: string;
  hover: string;
  labelColor: string;
  clickValue?: StatusFilter;
}

const CARDS: CardDef[] = [
  {
    key: 'total',
    label: '总记录数',
    Icon: ClipboardList,
    border: 'border-stone-200',
    bg: 'bg-white',
    iconBg: 'bg-stone-100',
    iconColor: 'text-stone-600',
    numberColor: 'text-stone-900',
    labelColor: 'text-stone-500',
    hover: 'hover:border-stone-400 hover:-translate-y-0.5',
  },
  {
    key: 'confirmed',
    label: '已确认',
    Icon: CheckCircle2,
    border: 'border-emerald-100',
    bg: 'bg-gradient-to-br from-emerald-50 to-white',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-[#2D6A4F]',
    numberColor: 'text-[#2D6A4F]',
    labelColor: 'text-emerald-700/80',
    hover: 'hover:border-emerald-300 hover:-translate-y-0.5',
    clickValue: 'confirmed',
  },
  {
    key: 'pending',
    label: '待补件',
    Icon: PackageOpen,
    border: 'border-orange-100',
    bg: 'bg-gradient-to-br from-orange-50 to-white',
    iconBg: 'bg-orange-100',
    iconColor: 'text-[#E87722]',
    numberColor: 'text-[#E87722]',
    labelColor: 'text-orange-700/80',
    hover: 'hover:border-orange-300 hover:-translate-y-0.5',
    clickValue: 'pending',
  },
  {
    key: 'returned',
    label: '已退回',
    Icon: RotateCcw,
    border: 'border-rose-100',
    bg: 'bg-gradient-to-br from-rose-50 to-white',
    iconBg: 'bg-rose-100',
    iconColor: 'text-[#C1121F]',
    numberColor: 'text-[#C1121F]',
    labelColor: 'text-rose-700/80',
    hover: 'hover:border-rose-300 hover:-translate-y-0.5',
    clickValue: 'returned',
  },
];

export function StatsCards() {
  const { stats, setStatusFilter } = useReconciliationStore();

  const getCount = (key: CardDef['key']) => {
    switch (key) {
      case 'total':
        return stats.total;
      case 'confirmed':
        return stats.confirmed;
      case 'pending':
        return stats.pending;
      case 'returned':
        return stats.returned;
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map((card) => {
        const count = getCount(card.key);
        const clickable = !!card.clickValue;
        return (
          <div
            key={card.key}
            onClick={() => clickable && setStatusFilter(card.clickValue!)}
            className={`relative rounded-xl border-2 ${card.border} ${card.bg} p-5 transition-all duration-200 shadow-sm ${
              clickable ? `cursor-pointer ${card.hover}` : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                <card.Icon size={22} className={card.iconColor} strokeWidth={2.2} />
              </div>
              {clickable && (
                <span className="text-[10px] text-stone-400 tracking-wide">点击筛选</span>
              )}
            </div>
            <div className={`text-3xl font-bold ${card.numberColor} mb-1 tabular-nums`}>
              {count}
            </div>
            <div className={`text-sm font-medium ${card.labelColor}`}>{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}

import { Clock, Copy, UserCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnomalyType } from '@/types';

interface AnomalyCardProps {
  type: AnomalyType;
  count: number;
  description: string;
  onClick?: () => void;
}

const configMap: Record<
  AnomalyType,
  {
    label: string;
    icon: typeof Clock;
    gradient: string;
    bgLight: string;
    textColor: string;
  }
> = {
  delayed: {
    label: '晚到数据',
    icon: Clock,
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  duplicate: {
    label: '采样瓶重复',
    icon: Copy,
    gradient: 'from-rose-500 to-red-600',
    bgLight: 'bg-rose-50',
    textColor: 'text-rose-700',
  },
  manual: {
    label: '人工确认',
    icon: UserCheck,
    gradient: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
};

export default function AnomalyCard({
  type,
  count,
  description,
  onClick,
}: AnomalyCardProps) {
  const config = configMap[type];
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-5 cursor-pointer',
        'transition-all duration-200 hover:shadow-md hover:border-slate-300',
        'group'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'w-11 h-11 rounded-lg bg-gradient-to-br flex items-center justify-center',
            config.gradient
          )}
        >
          <Icon className="w-5.5 h-5.5 text-white" />
        </div>
        <span className="text-2xl font-bold text-slate-800">{count}</span>
      </div>

      <h3 className="text-base font-semibold text-slate-800 mb-1">
        {config.label}
      </h3>
      <p className="text-sm text-slate-500 mb-4">{description}</p>

      <div className={cn('pt-3 border-t border-slate-100 flex items-center justify-between')}>
        <span className="text-xs text-slate-400">查看详情</span>
        <span
          className={cn(
            'text-sm font-medium group-hover:translate-x-1 transition-transform',
            config.textColor
          )}
        >
          <ArrowRight className="w-4 h-4 inline" />
        </span>
      </div>
    </div>
  );
}

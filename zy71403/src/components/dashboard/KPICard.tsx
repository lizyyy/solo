import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: LucideIcon;
  color: 'navy' | 'emerald' | 'amber' | 'rose' | 'sky';
  delay?: number;
  onClick?: () => void;
}

const colorClasses = {
  navy: {
    bg: 'bg-navy-50',
    iconBg: 'bg-navy-100',
    iconColor: 'text-navy-600',
    border: 'border-navy-100',
    value: 'text-navy-900',
  },
  emerald: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    border: 'border-emerald-100',
    value: 'text-emerald-700',
  },
  amber: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    border: 'border-amber-100',
    value: 'text-amber-700',
  },
  rose: {
    bg: 'bg-rose-50',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    border: 'border-rose-100',
    value: 'text-rose-700',
  },
  sky: {
    bg: 'bg-sky-50',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    border: 'border-sky-100',
    value: 'text-sky-700',
  },
};

export function KPICard({ title, value, subtitle, trend, icon: Icon, color, delay = 0, onClick }: KPICardProps) {
  const colors = colorClasses[color];
  const delayClass = delay > 0 ? `animate-delay-${delay}` : '';
  
  return (
    <div
      className={`bg-white rounded-xl border ${colors.border} p-5 card-hover cursor-pointer opacity-0 animate-fade-in-up ${delayClass} [animation-fill-mode:forwards]`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
          <p className={`font-mono text-2xl font-bold ${colors.value} mb-2`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend > 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : trend < 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}% 较昨日
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors.iconBg}`}>
          <Icon className={`w-6 h-6 ${colors.iconColor}`} />
        </div>
      </div>
    </div>
  );
}

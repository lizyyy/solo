import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'amber';
  subtitle?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'default',
  subtitle,
  className,
}: StatCardProps) {
  const colorClasses = {
    default: 'bg-studio-surface text-white',
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-orange-50 text-orange-700 border border-orange-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
    amber: 'bg-studio-amber/10 text-studio-amber border border-studio-amber/30',
  };

  const iconBgClasses = {
    default: 'bg-white/10',
    success: 'bg-green-100',
    warning: 'bg-orange-100',
    danger: 'bg-red-100',
    amber: 'bg-studio-amber/20',
  };

  return (
    <div
      className={cn(
        'rounded-xl p-4 transition-all duration-300 hover:shadow-lg animate-fade-in-up',
        colorClasses[color],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn(
            'text-sm',
            color === 'default' ? 'text-white/60' : 'text-gray-600'
          )}>
            {title}
          </p>
          <p className="text-2xl font-bold font-mono">{value}</p>
          {subtitle && (
            <p className={cn(
              'text-xs',
              color === 'default' ? 'text-white/40' : 'text-gray-500'
            )}>
              {subtitle}
            </p>
          )}
          {trend && trendValue && (
            <div className="flex items-center gap-1 text-xs mt-1">
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className={trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg', iconBgClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

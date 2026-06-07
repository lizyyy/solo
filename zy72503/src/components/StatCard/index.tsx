import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  gradient: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
  onClick,
  className,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 bg-white border border-slate-200/60 shadow-sm hover-lift transition-all duration-300 cursor-pointer group',
        className
      )}
    >
      <div
        className={cn(
          'absolute top-0 right-0 w-32 h-32 opacity-10 blur-2xl -translate-y-8 translate-x-8',
          gradient
        )}
      />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-800 font-mono tracking-tight animate-count-up">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded-md',
                    trend.isPositive
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-rose-600 bg-rose-50'
                  )}
                >
                  {trend.value}
                </span>
                <span className="text-xs text-slate-400">较昨日</span>
              </div>
            )}
          </div>
          
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
              gradient,
              'bg-opacity-20'
            )}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
      
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity',
          gradient
        )}
      />
    </div>
  );
}

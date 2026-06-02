import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

interface MetricCardProps {
  title: string;
  value: number;
  format?: 'percent' | 'number';
  change?: number;
  icon?: React.ReactNode;
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'slate';
  delay?: number;
}

export function MetricCard({
  title,
  value,
  format = 'percent',
  change,
  icon,
  color = 'primary',
  delay = 0,
}: MetricCardProps) {
  const colorClasses = {
    primary: 'from-primary-50 to-primary-100 border-primary-200 text-primary-700',
    emerald: 'from-accent-emerald-50 to-accent-emerald-100 border-accent-emerald-200 text-accent-emerald-700',
    amber: 'from-accent-amber-50 to-accent-amber-100 border-accent-amber-200 text-accent-amber-700',
    rose: 'from-accent-rose-50 to-accent-rose-100 border-accent-rose-200 text-accent-rose-700',
    slate: 'from-slate-50 to-slate-100 border-slate-200 text-slate-700',
  };

  const iconColorClasses = {
    primary: 'bg-primary-500 text-white',
    emerald: 'bg-accent-emerald-500 text-white',
    amber: 'bg-accent-amber-500 text-white',
    rose: 'bg-accent-rose-500 text-white',
    slate: 'bg-slate-500 text-white',
  };

  const displayValue = format === 'percent'
    ? `${(value * 100).toFixed(1)}%`
    : value.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "card p-5 bg-gradient-to-br border",
        colorClasses[color]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <p className="text-3xl font-bold font-serif tracking-tight">
            {displayValue}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0.001 ? (
                <TrendingUp className="w-4 h-4 text-accent-emerald-600" />
              ) : change < -0.001 ? (
                <TrendingDown className="w-4 h-4 text-accent-rose-600" />
              ) : (
                <Minus className="w-4 h-4 text-slate-500" />
              )}
              <span className={cn(
                "text-sm font-medium",
                change > 0.001 ? "text-accent-emerald-600" :
                change < -0.001 ? "text-accent-rose-600" : "text-slate-500"
              )}>
                {change > 0 ? '+' : ''}{(change * 100).toFixed(2)}%
              </span>
              <span className="text-xs text-slate-500 ml-1">vs 上次</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
            iconColorClasses[color]
          )}>
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}

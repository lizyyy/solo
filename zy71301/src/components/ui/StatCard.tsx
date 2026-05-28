import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'orange' | 'yellow' | 'red';
  className?: string;
}

const colorStyles = {
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  green: 'from-green-500/20 to-green-600/10 border-green-500/30',
  orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
  red: 'from-red-500/20 to-red-600/10 border-red-500/30',
};

const iconColors = {
  blue: 'text-blue-400',
  green: 'text-green-400',
  orange: 'text-orange-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

export default function StatCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  color = 'blue',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-5 border bg-gradient-to-br card-hover',
        colorStyles[color],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-400 mb-1">{title}</p>
          <p className="text-2xl font-display font-bold text-white">{value}</p>
          {trend && trendValue && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' && <ArrowUp className="w-3 h-3 text-green-400" />}
              {trend === 'down' && <ArrowDown className="w-3 h-3 text-red-400" />}
              {trend === 'neutral' && <Minus className="w-3 h-3 text-dark-400" />}
              <span
                className={cn(
                  'text-xs',
                  trend === 'up' && 'text-green-400',
                  trend === 'down' && 'text-red-400',
                  trend === 'neutral' && 'text-dark-400'
                )}
              >
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-lg bg-dark-700/50', iconColors[color])}>
          {icon}
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-current opacity-5 blur-2xl" />
    </div>
  );
}

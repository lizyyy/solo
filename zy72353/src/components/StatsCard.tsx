import { LucideIcon, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'primary' | 'warning' | 'success' | 'danger';
}

const StatsCard = ({ title, value, icon: Icon, trend, trendUp, color = 'primary' }: StatsCardProps) => {
  const colorClasses = {
    primary: 'bg-primary-500/20 text-primary-400',
    warning: 'bg-warning-500/20 text-warning-400',
    success: 'bg-success-500/20 text-success-400',
    danger: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-industrial-600 rounded-xl p-5 border border-industrial-500 hover:border-primary-500/50 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-industrial-300 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-white font-mono">{value}</p>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-sm",
              trendUp ? "text-success-400" : "text-warning-400"
            )}>
              <TrendingUp className={cn("w-4 h-4", !trendUp && "rotate-180")} />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;

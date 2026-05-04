import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../utils/cn';

export const StatCard = ({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
  className,
}) => {
  const colorStyles = {
    blue: {
      iconBg: 'bg-blue-50 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-900/50',
    },
    green: {
      iconBg: 'bg-green-50 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      border: 'border-green-100 dark:border-green-900/50',
    },
    purple: {
      iconBg: 'bg-purple-50 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-100 dark:border-purple-900/50',
    },
    orange: {
      iconBg: 'bg-orange-50 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-100 dark:border-orange-900/50',
    },
    red: {
      iconBg: 'bg-red-50 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      border: 'border-red-100 dark:border-red-900/50',
    },
    teal: {
      iconBg: 'bg-teal-50 dark:bg-teal-900/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-100 dark:border-teal-900/50',
    },
  };
  
  const style = colorStyles[color] || colorStyles.blue;
  
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };
  
  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm',
      style.border,
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
            {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
          </div>
          {trendValue !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon()}
              <span className={cn(
                'font-medium',
                trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
              )}>
                {trendValue > 0 ? '+' : ''}{trendValue}
              </span>
              <span className="text-gray-400">vs 上周</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('p-3 rounded-xl', style.iconBg)}>
            <Icon className={cn('w-6 h-6', style.iconColor)} />
          </div>
        )}
      </div>
    </div>
  );
};

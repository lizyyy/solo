import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  onClick?: () => void;
}

const colorClasses: Record<string, string> = {
  primary: 'from-blue-50 to-blue-100 border-blue-200',
  success: 'from-green-50 to-green-100 border-green-200',
  warning: 'from-amber-50 to-amber-100 border-amber-200',
  error: 'from-red-50 to-red-100 border-red-200',
  info: 'from-sky-50 to-sky-100 border-sky-200',
};

const iconColorClasses: Record<string, string> = {
  primary: 'bg-blue-500',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendLabel,
  icon,
  color = 'primary',
  onClick,
}) => {
  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-gray-600 font-medium">{title}</span>
        {icon && (
          <div className={`${iconColorClasses[color]} p-2 rounded-lg text-white`}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold font-serif text-gray-800">
          {value.toLocaleString()}
        </span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-sm">
          {trend > 0 ? (
            <TrendingUp size={14} className="text-success" />
          ) : trend < 0 ? (
            <TrendingDown size={14} className="text-error" />
          ) : (
            <Minus size={14} className="text-gray-400" />
          )}
          <span
            className={
              trend > 0
                ? 'text-success'
                : trend < 0
                ? 'text-error'
                : 'text-gray-500'
            }
          >
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
          {trendLabel && <span className="text-gray-500 ml-1">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
};

export default StatCard;

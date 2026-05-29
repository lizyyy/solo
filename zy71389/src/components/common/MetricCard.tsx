import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatPercent, formatNumber, calculateChangePercent } from '../../utils/format';

interface MetricCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  format?: 'number' | 'percent' | 'currency';
  decimals?: number;
  changeValue?: number;
  previousValue?: number;
  description?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  onClick?: () => void;
  isLoading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  prefix = '',
  suffix = '',
  format = 'number',
  decimals = 0,
  changeValue,
  previousValue,
  description,
  icon,
  color = 'primary',
  onClick,
  isLoading = false
}) => {
  const colorClasses = {
    primary: 'border-primary-200 hover:border-primary-400 hover:bg-primary-50/30',
    success: 'border-success-200 hover:border-success-400 hover:bg-success-50/30',
    warning: 'border-warning-200 hover:border-warning-400 hover:bg-warning-50/30',
    danger: 'border-danger-200 hover:border-danger-400 hover:bg-danger-50/30',
    gray: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50/30'
  }[color];
  
  const iconColorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    danger: 'bg-danger-100 text-danger-600',
    gray: 'bg-gray-100 text-gray-600'
  }[color];
  
  const formattedValue = typeof value === 'number'
    ? format === 'percent'
      ? formatPercent(value, decimals)
      : format === 'currency'
      ? `¥${formatNumber(value, decimals)}`
      : formatNumber(value, decimals)
    : value;
  
  let changeDisplay: React.ReactNode = null;
  if (changeValue !== undefined) {
    const isPositive = changeValue >= 0;
    changeDisplay = (
      <div className={`inline-flex items-center text-xs font-medium ${isPositive ? 'text-success-600' : 'text-danger-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
        {isPositive ? '+' : ''}{formatPercent(changeValue, 2)}
      </div>
    );
  } else if (previousValue !== undefined && typeof value === 'number') {
    const change = calculateChangePercent(previousValue, value);
    changeDisplay = (
      <div className={`inline-flex items-center text-xs font-medium ${change.isPositive ? 'text-success-600' : 'text-danger-600'}`}>
        {change.isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
        {change.isPositive ? '+' : ''}{change.value.toFixed(2)}%
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={cn(
        "bg-white border rounded-lg p-5 transition-all duration-200",
        colorClasses,
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 font-mono">
            {prefix}{formattedValue}{suffix}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {changeDisplay}
            {description && (
              <span className="text-xs text-gray-500">{description}</span>
            )}
          </div>
        </div>
        {icon && (
          <div className={cn("flex-shrink-0 p-2.5 rounded-lg", iconColorClasses)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

interface MetricsComparisonProps {
  title: string;
  originalValue: number;
  correctedValue: number;
  format?: 'number' | 'percent' | 'currency';
  decimals?: number;
}

export const MetricsComparison: React.FC<MetricsComparisonProps> = ({
  title,
  originalValue,
  correctedValue,
  format = 'number',
  decimals = 2
}) => {
  const formatValue = (value: number) => {
    if (format === 'percent') return formatPercent(value, decimals);
    if (format === 'currency') return `¥${formatNumber(value, decimals)}`;
    return formatNumber(value, decimals);
  };
  
  const diff = correctedValue - originalValue;
  const diffPercent = originalValue > 0 ? (diff / originalValue) * 100 : 0;
  const isPositive = diff >= 0;
  
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">原始值</p>
          <p className="text-lg font-semibold text-gray-500 font-mono line-through">{formatValue(originalValue)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">修正值</p>
          <p className="text-lg font-semibold text-primary-600 font-mono">{formatValue(correctedValue)}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">变化</span>
          <span className={`text-sm font-semibold font-mono ${isPositive ? 'text-success-600' : 'text-danger-600'}`}>
            {isPositive ? '+' : ''}{formatValue(diff)}
            <span className="ml-1">
              ({isPositive ? '+' : ''}{diffPercent.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

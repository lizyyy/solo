import React from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { RiskLevel } from '../../shared/types';
import { RISK_COLORS } from '../../shared/types';

export interface RiskCardProps {
  title: string;
  value: number | string;
  riskLevel: RiskLevel;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  className?: string;
  showProgress?: boolean;
  progress?: number;
  footer?: React.ReactNode;
}

const riskLevelLabels: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '极高风险',
};

const riskLevelTextColors: Record<RiskLevel, string> = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
};

const riskLevelBgColors: Record<RiskLevel, string> = {
  low: 'bg-green-50',
  medium: 'bg-amber-50',
  high: 'bg-orange-50',
  critical: 'bg-red-50',
};

const riskLevelBorderColors: Record<RiskLevel, string> = {
  low: 'border-green-200',
  medium: 'border-amber-200',
  high: 'border-orange-200',
  critical: 'border-red-200',
};

export const RiskCard: React.FC<RiskCardProps> = ({
  title,
  value,
  riskLevel,
  description,
  trend,
  trendValue,
  icon: Icon = AlertTriangle,
  onClick,
  className,
  showProgress = false,
  progress,
  footer,
}) => {
  const TrendIcon = trend === 'up'
    ? TrendingUp
    : trend === 'down'
    ? TrendingDown
    : Minus;

  const trendColor = trend === 'up'
    ? 'text-red-500'
    : trend === 'down'
    ? 'text-green-500'
    : 'text-slate-400';

  const displayProgress = progress ?? {
    low: 25,
    medium: 50,
    high: 75,
    critical: 95,
  }[riskLevel];

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-200',
        riskLevelBorderColors[riskLevel],
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      {/* Risk Indicator Bar */}
      <div className={cn('h-1.5 w-full', RISK_COLORS[riskLevel])} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              riskLevelBgColors[riskLevel]
            )}>
              <Icon className={cn('w-6 h-6', riskLevelTextColors[riskLevel])} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{title}</h3>
              <span className={cn(
                'inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium',
                riskLevelBgColors[riskLevel],
                riskLevelTextColors[riskLevel]
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', RISK_COLORS[riskLevel])} />
                {riskLevelLabels[riskLevel]}
              </span>
            </div>
          </div>

          {trend && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium',
              trend === 'up' && 'bg-red-50 text-red-600',
              trend === 'down' && 'bg-green-50 text-green-600',
              trend === 'stable' && 'bg-slate-50 text-slate-600'
            )}>
              {trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : trend === 'down' ? (
                <ArrowDownRight className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              {trendValue || (trend === 'up' ? '上升' : trend === 'down' ? '下降' : '持平')}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          </div>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>风险指数</span>
              <span className="font-medium text-slate-700">{displayProgress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', RISK_COLORS[riskLevel])}
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-green-500">低</span>
              <span className="text-xs text-amber-500">中</span>
              <span className="text-xs text-orange-500">高</span>
              <span className="text-xs text-red-500">极高</span>
            </div>
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="pt-4 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskCard;

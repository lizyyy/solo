import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Leaf } from 'lucide-react';
import type { Farm, FarmState } from '../types';
import { cn } from '../lib/utils';

interface FarmCardProps {
  farm: Farm;
  state: FarmState | undefined;
  rank?: number;
  onSelect?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

export const FarmCard: React.FC<FarmCardProps> = ({
  farm,
  state,
  rank,
  onSelect,
  selected,
  disabled,
}) => {
  if (!state) return null;

  const revenuePositive = state.revenue >= 0;
  const quotaLow = state.carbonQuota < 20;

  return (
    <div
      onClick={disabled ? undefined : onSelect}
      className={cn(
        'bg-white border-2 rounded-lg p-4 transition-all cursor-pointer',
        selected
          ? 'border-green-500 shadow-lg shadow-green-100'
          : 'border-gray-200 hover:border-green-300 hover:shadow-md',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: farm.color + '20' }}
          >
            <Leaf className="w-5 h-5" style={{ color: farm.color }} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">{farm.name}</h3>
            <p className="text-xs text-gray-500">{farm.owner}</p>
          </div>
        </div>
        {rank && (
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
              rank === 1
                ? 'bg-yellow-100 text-yellow-700'
                : rank === 2
                ? 'bg-gray-100 text-gray-600'
                : rank === 3
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-50 text-gray-500'
            )}
          >
            {rank}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">碳配额</span>
          <div className="flex items-center gap-1">
            <span className={cn('font-medium', quotaLow && 'text-red-600')}>
              {state.carbonQuota} 吨
            </span>
            {quotaLow && <AlertTriangle className="w-4 h-4 text-red-500" />}
          </div>
        </div>

        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (state.carbonQuota / farm.initialQuota) * 100)}%`,
              backgroundColor: quotaLow ? '#ef4444' : farm.color,
            }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">土地面积</span>
          <span className="font-medium">{state.landArea} 亩</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">作物类型</span>
          <span className="font-medium">{state.cropType}</span>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">当前收益</span>
            <div
              className={cn(
                'flex items-center gap-1 font-bold',
                revenuePositive ? 'text-green-600' : 'text-red-600'
              )}
            >
              {revenuePositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              ¥{Math.abs(state.revenue)}
            </div>
          </div>
        </div>

        {state.warning && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{state.warning}</span>
          </div>
        )}
      </div>
    </div>
  );
};

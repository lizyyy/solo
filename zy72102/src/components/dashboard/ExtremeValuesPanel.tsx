import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ExtremeValue } from '../../types';
import { formatTime, getFieldName, getFieldUnit } from '../../utils/formatters';
import { cn } from '../../lib/utils';

interface ExtremeValuesPanelProps {
  extremeValues: ExtremeValue[];
  onHighlight: (dataIndex: number) => void;
  className?: string;
}

export function ExtremeValuesPanel({
  extremeValues,
  onHighlight,
  className,
}: ExtremeValuesPanelProps) {
  const maxValues = extremeValues.filter((v) => v.type === 'max');
  const minValues = extremeValues.filter((v) => v.type === 'min');

  const ValueCard = ({ value }: { value: ExtremeValue }) => {
    const isMax = value.type === 'max';
    const isSignificant = Math.abs(value.deviationPercent) > 20;

    return (
      <div
        className={cn(
          'cursor-pointer rounded-lg p-4 transition-all hover:shadow-lg',
          isMax ? 'bg-orange-500/10' : 'bg-cyan-500/10',
          isSignificant && (isMax ? 'ring-1 ring-orange-500/50' : 'ring-1 ring-cyan-500/50')
        )}
        onClick={() => onHighlight(value.dataIndex)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isMax ? (
              <TrendingUp className="h-4 w-4 text-orange-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-cyan-400" />
            )}
            <span className="text-sm font-medium text-white">
              {getFieldName(value.field)}
            </span>
          </div>
          <span
            className={cn(
              'text-xs',
              value.deviationPercent > 0 ? 'text-orange-400' : 'text-cyan-400'
            )}
          >
            {value.deviationPercent > 0 ? '+' : ''}
            {value.deviationPercent.toFixed(1)}%
          </span>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-white">
            {value.value.toFixed(2)}
          </span>
          <span className="ml-1 text-sm text-slate-400">
            {getFieldUnit(value.field)}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          均值: {value.avgValue.toFixed(2)} {getFieldUnit(value.field)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatTime(value.timestamp)}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('rounded-lg bg-slate-800/50 p-6', className)}>
      <h3 className="mb-4 text-lg font-medium text-white">极端值分析</h3>
      <p className="mb-4 text-sm text-slate-400">
        单独列出各指标的最大/最小值，避免被平均值掩盖
      </p>

      <div className="space-y-4">
        <div>
          <h4 className="mb-2 flex items-center space-x-2 text-sm font-medium text-orange-400">
            <TrendingUp className="h-4 w-4" />
            <span>最大值</span>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {maxValues.map((value) => (
              <ValueCard key={value.id} value={value} />
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center space-x-2 text-sm font-medium text-cyan-400">
            <TrendingDown className="h-4 w-4" />
            <span>最小值</span>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {minValues.map((value) => (
              <ValueCard key={value.id} value={value} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

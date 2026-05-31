import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { Resources } from '@/types';
import { RESOURCE_LABELS, RESOURCE_UNITS } from '@/types';
import { formatNumber } from '@/utils/helpers';

interface ResourcePanelProps {
  resources: Resources;
  hasNegative: boolean;
  title?: string;
  showComparison?: boolean;
  previousResources?: Resources;
}

export function ResourcePanel({
  resources,
  hasNegative,
  title = '当前资源状态',
  showComparison = false,
  previousResources,
}: ResourcePanelProps) {
  const resourceKeys = Object.keys(resources) as (keyof Resources)[];

  const getTrendIcon = (key: keyof Resources) => {
    if (!showComparison || !previousResources) return null;
    
    const diff = resources[key] - previousResources[key];
    if (Math.abs(diff) < 0.01) return <Minus className="w-4 h-4 text-slate-400" />;
    if (diff > 0) return <TrendingUp className="w-4 h-4 text-success-400" />;
    return <TrendingDown className="w-4 h-4 text-danger-400" />;
  };

  const getTrendValue = (key: keyof Resources) => {
    if (!showComparison || !previousResources) return null;
    
    const diff = resources[key] - previousResources[key];
    if (Math.abs(diff) < 0.01) return null;
    
    const sign = diff > 0 ? '+' : '';
    return (
      <span className={`text-xs ${diff > 0 ? 'text-success-400' : 'text-danger-400'}`}>
        {sign}{formatNumber(diff)}
      </span>
    );
  };

  const getValueColor = (key: keyof Resources, value: number) => {
    if (value < 0) return 'text-danger-400 font-bold';
    
    if (key === 'inflation') {
      if (value >= 2 && value <= 3.5) return 'text-success-400';
      if (value > 4) return 'text-warning-400';
    }
    
    if (key === 'gdpGrowth') {
      if (value >= 5 && value <= 6.5) return 'text-success-400';
      if (value < 4) return 'text-warning-400';
    }
    
    if (key === 'employment') {
      if (value >= 4.5 && value <= 5.5) return 'text-success-400';
      if (value > 6) return 'text-warning-400';
    }
    
    return 'text-white';
  };

  return (
    <div className={`card ${hasNegative ? 'card-danger' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-accent-400">{title}</h3>
        {hasNegative && (
          <div className="flex items-center gap-1 text-danger-400 text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>资源异常</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {resourceKeys.map((key) => {
          const value = resources[key];
          const isNegative = value < 0;
          
          return (
            <div
              key={key}
              className={`p-3 rounded-lg ${isNegative ? 'bg-danger-500/20 border border-danger-500/30 animate-pulse-slow' : 'bg-white/5'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/60">{RESOURCE_LABELS[key]}</span>
                {getTrendIcon(key)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold ${getValueColor(key, value)}`}>
                  {formatNumber(value)}
                </span>
                <span className="text-xs text-white/50">{RESOURCE_UNITS[key]}</span>
                {getTrendValue(key)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

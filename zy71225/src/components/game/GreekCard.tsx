import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import type { GreekValues, GreekTarget } from '@/types';
import { getGreekStatus, getGreekDeviationPercent } from '@/engine/greekCalculator';
import { formatNumber, getGreekLabel, getGreekUnit } from '@/utils/format';

interface GreekCardProps {
  name: keyof GreekValues;
  value: number;
  target: { min: number; max: number };
  isHighlight?: boolean;
  handwrittenNote?: string;
}

export const GreekCard: React.FC<GreekCardProps> = ({
  name,
  value,
  target,
  isHighlight = false,
  handwrittenNote,
}) => {
  const status = getGreekStatus(value, target);
  const deviation = getGreekDeviationPercent(value, target);
  
  const statusColors = {
    safe: 'border-trader-green/50 bg-trader-green/5',
    warning: 'border-warning-orange/50 bg-warning-orange/10 risk-glow-yellow',
    danger: 'border-trader-red/50 bg-trader-red/10 risk-glow-red',
  };
  
  const progressColors = {
    safe: 'bg-trader-green',
    warning: 'bg-warning-orange',
    danger: 'bg-trader-red',
  };
  
  const textColors = {
    safe: 'text-trader-green',
    warning: 'text-warning-orange',
    danger: 'text-trader-red',
  };

  const range = target.max - target.min;
  const midPoint = (target.min + target.max) / 2;
  const normalizedValue = ((value - midPoint) / (range / 2) + 1) / 2;
  const progressPercent = Math.max(0, Math.min(100, normalizedValue * 100));
  
  const isCritical = status === 'danger' && (name === 'gamma' || name === 'vega');

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 transition-all duration-300
        ${statusColors[status]}
        ${isHighlight ? 'transform scale-105 z-10' : ''}
        ${isCritical ? 'animate-pulse-slow' : ''}
        paper-texture coffee-stain
      `}
    >
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
        <div className="bg-highlight-blue/40 px-3 py-0.5 rounded text-xs font-hand text-white transform -rotate-1">
          {getGreekLabel(name)}
        </div>
      </div>

      <div className="mt-2 text-center">
        <div className={`font-mono text-3xl font-bold ${textColors[status]} ${isCritical ? 'text-shadow-glow' : ''}`}>
          {formatNumber(value, name === 'gamma' ? 4 : 2)}
          <span className="text-sm font-normal text-bloomberg-muted ml-1">
            {getGreekUnit(name)}
          </span>
        </div>
        
        <div className="text-xs text-bloomberg-muted mt-1">
          目标: [{formatNumber(target.min, 0)}, {formatNumber(target.max, 0)}]
        </div>
      </div>

      <div className="mt-3">
        <div className="relative h-2 bg-bloomberg-border/50 rounded-full overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="w-1/4 bg-trader-red/20" />
            <div className="w-1/2 bg-trader-green/20" />
            <div className="w-1/4 bg-trader-red/20" />
          </div>
          
          <div
            className={`absolute top-0 h-full ${progressColors[status]} rounded-full transition-all duration-500`}
            style={{ width: `${progressPercent}%` }}
          />
          
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-bloomberg-bg transition-all duration-500"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>
      </div>

      {deviation !== 0 && (
        <div className={`mt-2 flex items-center justify-center gap-1 text-xs ${textColors[status]}`}>
          {deviation > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>偏离 {Math.abs(deviation)}%</span>
        </div>
      )}

      {status !== 'safe' && (
        <div className="absolute -top-2 -right-2">
          <AlertTriangle size={16} className={textColors[status]} />
        </div>
      )}

      {handwrittenNote && (
        <div className="absolute -bottom-2 -right-2 transform rotate-3">
          <div className="bg-highlight-yellow/90 text-bloomberg-bg px-2 py-0.5 rounded text-xs font-hand">
            {handwrittenNote}
          </div>
        </div>
      )}
    </div>
  );
};

interface GreekMonitorBoardProps {
  greeks: GreekValues;
  targets: GreekTarget;
}

export const GreekMonitorBoard: React.FC<GreekMonitorBoardProps> = ({ greeks, targets }) => {
  const greekKeys: Array<keyof GreekValues> = ['delta', 'gamma', 'vega', 'theta', 'rho'];
  const highlightKeys: Array<keyof GreekValues> = ['gamma', 'vega'];
  
  const handwrittenNotes: Partial<Record<keyof GreekValues, string>> = {
    delta: '盯住中性！',
    gamma: '重点监控',
    vega: 'IV杀手',
  };

  return (
    <div className="grid grid-cols-5 gap-4">
      {greekKeys.map((key) => (
        <GreekCard
          key={key}
          name={key}
          value={greeks[key]}
          target={
            key in targets
              ? (targets as unknown as Record<string, { min: number; max: number; }>)[key]
              : { min: -1000, max: 1000 }
          }
          isHighlight={highlightKeys.includes(key)}
          handwrittenNote={handwrittenNotes[key]}
        />
      ))}
    </div>
  );
};

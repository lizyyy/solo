import { useState } from 'react';
import type { AnomalyType } from '../../types';
import { getAnomalyLabel, getAnomalyColor, ANOMALY_RULES } from '../../utils/anomalyDetector';
import { AlertTriangle, XCircle, Info } from 'lucide-react';

interface AnomalyBadgeProps {
  anomalies: AnomalyType[];
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

export function AnomalyBadge({ anomalies, showTooltip = true, size = 'md' }: AnomalyBadgeProps) {
  const [hoveredType, setHoveredType] = useState<AnomalyType | null>(null);
  
  if (anomalies.length === 0) return null;
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };
  
  const hasError = anomalies.some(a => ANOMALY_RULES[a]?.severity === 'error');
  const mainColor = hasError ? 'rose' : 'amber';
  
  return (
    <div className="relative inline-flex items-center gap-1">
      <div className="flex -space-x-1">
        {anomalies.slice(0, 3).map((type, idx) => {
          const color = getAnomalyColor(type);
          const isError = ANOMALY_RULES[type]?.severity === 'error';
          const Icon = isError ? XCircle : AlertTriangle;
          
          return (
            <div
              key={type}
              className={`relative rounded-full bg-white p-0.5 cursor-pointer transition-transform hover:scale-110 z-${10 - idx}`}
              onMouseEnter={() => showTooltip && setHoveredType(type)}
              onMouseLeave={() => setHoveredType(null)}
            >
              <Icon className={`${sizeClasses[size]} text-${color}-500`} />
            </div>
          );
        })}
      </div>
      
      {anomalies.length > 3 && (
        <span className={`text-xs font-medium text-${mainColor}-600`}>
          +{anomalies.length - 3}
        </span>
      )}
      
      {hoveredType && showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-48">
          <div className="bg-slate-800 text-white text-xs rounded-md px-3 py-2 shadow-lg">
            <div className="font-medium mb-1">{getAnomalyLabel(hoveredType)}</div>
            <div className="text-slate-300 flex items-start gap-1.5">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{ANOMALY_RULES[hoveredType]?.message}</span>
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

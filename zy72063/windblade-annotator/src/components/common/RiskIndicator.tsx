import { RISK_LABELS, RISK_COLORS } from '../../types';
import type { RiskLevel } from '../../types';

interface RiskIndicatorProps {
  level: RiskLevel;
  showLabel?: boolean;
  className?: string;
}

export const RiskIndicator = ({ level, showLabel = false, className = '' }: RiskIndicatorProps) => {
  const color = RISK_COLORS[level];
  const label = RISK_LABELS[level];

  const bars = {
    low: 1,
    medium: 2,
    high: 3
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="flex items-end gap-0.5 h-4">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-1.5 rounded-sm transition-all ${
              i <= bars[level] ? `${color}` : 'bg-gray-600'
            }`}
            style={{ height: `${i * 4}px` }}
          />
        ))}
      </div>
      {showLabel && (
        <span className={`text-xs font-medium ${
          level === 'high' ? 'text-red-400' :
          level === 'medium' ? 'text-warning-400' :
          'text-success-400'
        }`}>
          {label}
        </span>
      )}
    </div>
  );
};

import { RiskLevel } from '@/types';
import { RISK_COLORS } from '@/constants/purposeCodes';

interface RiskIndicatorProps {
  level: RiskLevel;
  showLabel?: boolean;
}

export const RiskIndicator = ({ level, showLabel = true }: RiskIndicatorProps) => {
  const color = RISK_COLORS[level];
  const label = level === 'normal' ? '正常' : level === 'warning' ? '预警' : '高风险';
  const pulseClass = level === 'danger' ? 'animate-pulse' : level === 'warning' ? 'animate-pulse' : '';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color} ${pulseClass}`} />
      {showLabel && (
        <span className={`text-sm font-medium ${level === 'danger' ? 'text-red-700' : level === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
          {label}
        </span>
      )}
    </div>
  );
};

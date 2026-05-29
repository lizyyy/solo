import { getRiskLevelLabel } from '../utils/riskCalculator';
import type { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

const colorMap: Record<RiskLevel, string> = {
  low: 'bg-risk-low/10 text-risk-low border-risk-low/20',
  medium: 'bg-risk-medium/10 text-risk-medium border-risk-medium/20',
  high: 'bg-risk-high/10 text-risk-high border-risk-high/20',
  blocker: 'bg-risk-blocker/10 text-risk-blocker border-risk-blocker/20',
};

export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span className={`badge border ${colorMap[level]}`}>
      {getRiskLevelLabel(level)}
    </span>
  );
}

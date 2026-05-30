import type { RiskLevel } from '../../shared/types';
import { getRiskLevelText, getRiskLevelBadgeClass } from '../store';

interface RiskBadgeProps {
  level: RiskLevel;
  showText?: boolean;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, showText = true, size = 'md' }: RiskBadgeProps) {
  const text = getRiskLevelText(level);
  const badgeClass = getRiskLevelBadgeClass(level);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`badge ${badgeClass} ${sizeClass}`}>
      {showText && text}
    </span>
  );
}

interface RiskScoreBadgeProps {
  score: number;
  showScore?: boolean;
}

export function RiskScoreBadge({ score, showScore = true }: RiskScoreBadgeProps) {
  let level: RiskLevel = 'low';
  if (score >= 75) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 25) level = 'medium';

  const badgeClass = getRiskLevelBadgeClass(level);

  return (
    <span className={`badge ${badgeClass} px-3 py-1 font-mono font-semibold`}>
      {showScore && score}
    </span>
  );
}

interface RiskProgressBarProps {
  score: number;
  showLabel?: boolean;
}

export function RiskProgressBar({ score, showLabel = true }: RiskProgressBarProps) {
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  
  let barColor = 'bg-risk-low';
  if (normalizedScore >= 75) barColor = 'bg-risk-critical';
  else if (normalizedScore >= 50) barColor = 'bg-risk-high';
  else if (normalizedScore >= 25) barColor = 'bg-risk-medium';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">风险评分</span>
          <span className="font-semibold font-mono">{normalizedScore}</span>
        </div>
      )}
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${barColor}`}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
}

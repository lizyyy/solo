import { RiskLevel } from '../../types';

interface RiskBadgeProps {
  level: RiskLevel;
  showLabel?: boolean;
}

const riskConfig: Record<RiskLevel, { label: string; color: string; bgColor: string }> = {
  low: { label: '低风险', color: '#4A7C59', bgColor: 'rgba(74, 124, 89, 0.2)' },
  medium: { label: '中风险', color: '#B5651D', bgColor: 'rgba(181, 101, 29, 0.2)' },
  high: { label: '高风险', color: '#8B0000', bgColor: 'rgba(139, 0, 0, 0.2)' },
};

export function RiskBadge({ level, showLabel = true }: RiskBadgeProps) {
  const config = riskConfig[level];

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <span
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ backgroundColor: config.color }}
      />
      {showLabel && config.label}
    </div>
  );
}

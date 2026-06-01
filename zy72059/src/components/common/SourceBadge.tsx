import { SOURCE_COLORS, SOURCE_LABELS } from '@/types';
import type { SourceType } from '@/types';

interface SourceBadgeProps {
  type: SourceType;
  className?: string;
}

export function SourceBadge({ type, className = '' }: SourceBadgeProps) {
  const color = SOURCE_COLORS[type];
  const label = SOURCE_LABELS[type];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

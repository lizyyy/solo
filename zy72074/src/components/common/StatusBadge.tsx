import type { PointStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS } from '../../types';

interface StatusBadgeProps {
  status: PointStatus;
  isAnomaly?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, isAnomaly = false, size = 'md' }: StatusBadgeProps) {
  const color = isAnomaly ? '#ef4444' : STATUS_COLORS[status];
  const label = isAnomaly ? '异常' : STATUS_LABELS[status];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

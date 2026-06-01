import { STATUS_COLORS, STATUS_LABELS } from '@/types';
import type { StatusType } from '@/types';

interface StatusBadgeProps {
  status: StatusType;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse = false, className = '' }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  const shouldPulse = pulse && (status === 'WARNING' || status === 'CONFIRM' || status === 'ERROR' || status === 'BOUNDARY');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        className={`w-2 h-2 rounded-full ${shouldPulse ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

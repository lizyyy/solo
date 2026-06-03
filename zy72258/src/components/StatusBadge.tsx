import { PROCESSING_STATUS_LABELS, PROCESSING_STATUS_COLORS, type ProcessingStatus } from '../types';

interface StatusBadgeProps {
  status: ProcessingStatus;
  showLabel?: boolean;
}

export function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const colorClass = PROCESSING_STATUS_COLORS[status];
  const label = PROCESSING_STATUS_LABELS[status];

  return (
    <span className={`status-badge ${colorClass} ${status === 'missing_row' ? 'animate-blink' : ''}`}>
      {showLabel ? label : status}
    </span>
  );
}

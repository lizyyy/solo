import type { ReviewStatus } from '../types';
import { getStatusLabel, getStatusColor } from '../utils/format';

interface StatusBadgeProps {
  status: ReviewStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span className={`badge ${getStatusColor(status)} ${className}`}>
      {getStatusLabel(status)}
    </span>
  );
}

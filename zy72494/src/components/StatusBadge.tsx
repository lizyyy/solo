import { STATUS_LABELS, STATUS_COLORS, ComplaintStatus } from '../types';

interface StatusBadgeProps {
  status: ComplaintStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

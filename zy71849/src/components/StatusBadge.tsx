import { SightStatus, InspectionCategory, FlipType, SIGHT_STATUS_LABELS, INSPECTION_CATEGORY_LABELS, FLIP_TYPE_LABELS } from '@/types';

interface StatusBadgeProps {
  status: SightStatus | InspectionCategory | FlipType;
  type?: 'sight' | 'inspection' | 'flip';
}

export default function StatusBadge({ status, type = 'sight' }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    confirmed: 'badge-confirmed',
    pending: 'badge-pending',
    'manual-modified': 'badge-manual',
    'flip-detected': 'badge-flip',
    'pending-supplement': 'badge-pending',
    'none': 'bg-slate-100 text-slate-600',
    'x-flip': 'badge-flip',
    'y-flip': 'badge-flip',
    'z-flip': 'badge-flip',
    'xy-flip': 'badge-flip',
    'xz-flip': 'badge-flip',
    'yz-flip': 'badge-flip',
    'xyz-flip': 'badge-flip',
  };

  const labels: Record<string, string> = {
    ...SIGHT_STATUS_LABELS,
    ...INSPECTION_CATEGORY_LABELS,
    ...FLIP_TYPE_LABELS,
  };

  const className = `badge ${styles[status] || 'bg-slate-100 text-slate-600'}`;

  return (
    <span className={className}>
      {labels[status] || status}
    </span>
  );
}

import { HitReason, HIT_REASON_LABELS } from '../../shared/types';
import { cn } from '../lib/utils';

interface HitReasonBadgeProps {
  reason: HitReason;
}

const reasonColors: Record<HitReason, string> = {
  threshold_exceeded: 'bg-red-500/10 text-red-400',
  whitelist_expired: 'bg-yellow-500/10 text-yellow-400',
  window_overlap: 'bg-purple-500/10 text-purple-400',
  false_positive: 'bg-blue-500/10 text-blue-400',
};

function HitReasonBadge({ reason }: HitReasonBadgeProps) {
  const label = HIT_REASON_LABELS[reason];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        reasonColors[reason]
      )}
    >
      {label}
    </span>
  );
}

export { HitReasonBadge };

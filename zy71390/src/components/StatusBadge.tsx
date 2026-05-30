import { RuleStatus, STATUS_COLORS, STATUS_LABELS } from '../../shared/types';
import { cn } from '../lib/utils';

interface StatusBadgeProps {
  status: RuleStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        status === 'active' && 'bg-green-500/10 text-green-400',
        status === 'draft' && 'bg-yellow-500/10 text-yellow-400',
        status === 'deprecated' && 'bg-gray-500/10 text-gray-400'
      )}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export { StatusBadge };

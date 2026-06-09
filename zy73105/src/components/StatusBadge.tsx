import type { ConclusionStatus } from '../types/review';
import { STATUS_BADGE_CLASS, STATUS_LABEL } from '../utils/statusMappings';

interface Props {
  status: ConclusionStatus;
  size?: 'sm' | 'md';
  withDot?: boolean;
}

export function StatusBadge({ status, size = 'md', withDot = true }: Props) {
  const label = STATUS_LABEL[status];
  const cls = STATUS_BADGE_CLASS[status];
  const dotMap: Record<ConclusionStatus, string> = {
    confirmed: 'bg-status-confirmed',
    'pending-material': 'bg-status-pending',
    returned: 'bg-status-returned',
    draft: 'bg-slate-400',
  };
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${cls} ${sizeCls} transition-transform hover:scale-105`}
    >
      {withDot && <span className={`w-1.5 h-1.5 rounded-full ${dotMap[status]}`} />}
      {label}
    </span>
  );
}

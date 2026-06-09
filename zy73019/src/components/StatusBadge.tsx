import { STATUS_LABEL, type TrackStatus } from '../../shared/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: TrackStatus;
}

const statusStyles: Record<TrackStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-300',
  observing: 'bg-[#B8956A]/15 text-[#8B6E4A] border-[#B8956A]/40',
  recovered: 'bg-[#7A9E7E]/15 text-[#5A7D5E] border-[#7A9E7E]/40',
  transferred: 'bg-[#D97706]/15 text-[#B45309] border-[#D97706]/40',
  closed_normal: 'bg-[#7A9E7E]/20 text-[#4A6B4E] border-[#7A9E7E]/50',
  closed_abnormal: 'bg-[#B91C1C]/15 text-[#991B1B] border-[#B91C1C]/40',
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border',
        statusStyles[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
};

export default StatusBadge;

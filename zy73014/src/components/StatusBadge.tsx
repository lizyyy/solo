import { STATUS_COLOR, STATUS_LABEL, type FollowUpStatus } from '@/types';

export default function StatusBadge({ status, pulse }: { status: FollowUpStatus; pulse?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border font-kai whitespace-nowrap',
        STATUS_COLOR[status],
        pulse ? 'animate-pulseSoft' : '',
      ].join(' ')}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status]}
    </span>
  );
}

import type { CollisionStatus } from '@/types';
import { STATUS_BG_CLASS, STATUS_LABEL } from '@/types';

interface Props {
  status: CollisionStatus;
  rejudgeCount?: number;
  compact?: boolean;
}

export function StatusTag({ status, rejudgeCount = 0, compact = false }: Props) {
  const base = `${STATUS_BG_CLASS[status]} text-white text-xs font-semibold inline-flex items-center gap-1`;
  const size = compact ? 'px-2 py-0.5 rounded' : 'px-2.5 py-1 rounded';
  return (
    <span className={`${base} ${size}`}>
      <span>{STATUS_LABEL[status]}</span>
      {rejudgeCount > 0 && (
        <span className="bg-white/25 rounded px-1 tnum text-[10px] leading-none">×{rejudgeCount}</span>
      )}
    </span>
  );
}

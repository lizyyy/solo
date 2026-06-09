import type { MaterialStatus, NoteResult } from '../types';
import { STATUS_LABEL, NOTE_RESULT_LABEL } from '../types';
import { CheckCircle2, Clock, XCircle, AlertTriangle, CircleCheck, CircleDot, ArrowUpRight } from 'lucide-react';

export function StatusTag({ status, size = 'sm' }: { status: MaterialStatus; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'px-2.5 py-1 text-xs' : '';
  if (status === 'CONFIRMED')
    return (
      <span className={`tag tag-confirm ${cls}`}>
        <CheckCircle2 size={size === 'md' ? 14 : 12} />
        {STATUS_LABEL.CONFIRMED}
      </span>
    );
  if (status === 'PENDING')
    return (
      <span className={`tag tag-pending ${cls}`}>
        <Clock size={size === 'md' ? 14 : 12} />
        {STATUS_LABEL.PENDING}
      </span>
    );
  return (
    <span className={`tag tag-reject ${cls}`}>
      <XCircle size={size === 'md' ? 14 : 12} />
      {STATUS_LABEL.REJECTED}
    </span>
  );
}

export function NoteResultTag({ result }: { result: NoteResult }) {
  if (result === 'RESOLVED')
    return (
      <span className="tag tag-confirm">
        <CircleCheck size={12} />
        {NOTE_RESULT_LABEL.RESOLVED}
      </span>
    );
  if (result === 'IN_PROGRESS')
    return (
      <span className="tag tag-pending">
        <CircleDot size={12} />
        {NOTE_RESULT_LABEL.IN_PROGRESS}
      </span>
    );
  return (
    <span className="tag tag-abnormal">
      <ArrowUpRight size={12} />
      {NOTE_RESULT_LABEL.ESCALATED}
    </span>
  );
}

export function AbnormalBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      } font-bold text-white bg-fire-500 border border-fire-700`}
      style={{
        clipPath:
          'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
      }}
      title="图层命名异常"
    >
      <AlertTriangle size={small ? 10 : 12} />
      图层异常
    </span>
  );
}

import type { MaterialStatus, HistoryAction } from '../../../shared/types';
import { STATUS_LABELS, STATUS_COLORS, ACTION_LABELS } from '../../../shared/types';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: MaterialStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-all duration-200 hover:shadow-sm',
        STATUS_COLORS[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const ACTION_DOT_COLORS: Record<HistoryAction, string> = {
  create: 'bg-teal-500',
  update: 'bg-slate-400',
  rejudge: 'bg-blue-500',
  cad_note: 'bg-amber-500',
  change_order: 'bg-purple-500',
  csv_import: 'bg-emerald-500',
  csv_update: 'bg-cyan-500',
};

export function ActionBadge({ action }: { action: HistoryAction }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={clsx('w-1.5 h-1.5 rounded-full', ACTION_DOT_COLORS[action])} />
      <span className="text-slate-700 font-medium">{ACTION_LABELS[action]}</span>
    </span>
  );
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

import type { SettlementStatus } from '../types';
import { STATUS_LABELS } from '../types';

interface StatusBadgeProps {
  status: SettlementStatus;
  showDot?: boolean;
  pulse?: boolean;
}

const statusStyles: Record<SettlementStatus, { bg: string; text: string; dot: string; border: string }> = {
  pending: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-700',
    dot: 'bg-neutral-500',
    border: 'border-neutral-300',
  },
  confirmed: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    dot: 'bg-success-500',
    border: 'border-success-200',
  },
  need_material: {
    bg: 'bg-warning-50',
    text: 'text-warning-700',
    dot: 'bg-warning-500',
    border: 'border-warning-200',
  },
  manual_adjust: {
    bg: 'bg-adjust-50',
    text: 'text-adjust-700',
    dot: 'bg-adjust-500',
    border: 'border-adjust-200',
  },
  conflict: {
    bg: 'bg-danger-50',
    text: 'text-danger-700',
    dot: 'bg-danger-500',
    border: 'border-danger-200',
  },
};

export default function StatusBadge({ status, showDot = true, pulse = false }: StatusBadgeProps) {
  const style = statusStyles[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded ${style.bg} ${style.text} ${style.border}`}
    >
      {showDot && (
        <span
          className={`w-2 h-2 rounded-full ${style.dot} ${pulse ? 'animate-pulse-slow' : ''}`}
        />
      )}
      {label}
    </span>
  );
}

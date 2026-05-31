import { DepositStatus, STATUS_LABELS } from '../types';

interface StatusBadgeProps {
  status: DepositStatus;
}

const statusStyles: Record<DepositStatus, { bg: string; text: string; border: string } = {
  pending_entry: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  refund_list_entered: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  waiting_settlement: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  settlement_attached: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300' },
  pending_review: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  pending_recheck: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles.bg} ${styles.text} ${styles.border}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

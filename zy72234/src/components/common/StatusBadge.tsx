import { STATUS_LABELS, STATUS_COLORS, isZeroReversed } from '@shared/types';
import type { AdjustmentStatus } from '@shared/types';

interface StatusBadgeProps {
  status: AdjustmentStatus;
  amount?: number;
  remark?: string;
}

export default function StatusBadge({ status, amount, remark }: StatusBadgeProps) {
  const isZeroReversedRecord = amount !== undefined && remark !== undefined 
    ? isZeroReversed(amount, remark) 
    : false;

  const displayStatus = isZeroReversedRecord && status !== 'reviewed_normal' && status !== 'needs_verification'
    ? 'pending_review'
    : status;

  const label = STATUS_LABELS[displayStatus];
  const color = STATUS_COLORS[displayStatus];

  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    orange: 'bg-warning-orange-light text-warning-orange border-warning-orange/30',
    red: 'bg-risk-red-light text-risk-red border-risk-red/30',
    green: 'bg-finance-green-light text-finance-green border-finance-green/30',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        color === 'red' ? 'bg-risk-red animate-pulse-slow' : 
        color === 'green' ? 'bg-finance-green' : 
        color === 'orange' ? 'bg-warning-orange' : 'bg-gray-400'
      }`} />
      {label}
      {isZeroReversedRecord && (
        <span className="ml-1.5 px-1.5 py-0.5 bg-risk-red/10 text-risk-red rounded text-[10px] border border-risk-red/20">
          已冲正
        </span>
      )}
    </span>
  );
}

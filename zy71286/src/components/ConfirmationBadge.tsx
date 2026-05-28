import { Check, Pencil } from 'lucide-react';
import type { ConfirmationStatus } from '@/types';
import { CONFIRMATION_LABELS } from '@/types';

interface ConfirmationBadgeProps {
  status: ConfirmationStatus;
  showIcon?: boolean;
}

export default function ConfirmationBadge({ status, showIcon = true }: ConfirmationBadgeProps) {
  const isConfirmed = status === 'CONFIRMED';
  const label = CONFIRMATION_LABELS[status];

  return (
    <span className={isConfirmed ? 'status-badge confirmation-confirmed' : 'status-badge confirmation-temporary'}>
      {showIcon && (
        isConfirmed
          ? <Check className="w-3 h-3 mr-1" />
          : <Pencil className="w-3 h-3 mr-1" />
      )}
      {label}
    </span>
  );
}

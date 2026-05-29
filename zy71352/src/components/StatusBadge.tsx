import { cn } from '../lib/utils';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TRANSPORT_STATUS_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
} from '../../shared/types';
import type { RecordStatus, TransportStatus, AlertSeverity } from '../../shared/types';

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      STATUS_COLORS[status],
      className
    )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface TransportStatusBadgeProps {
  status: TransportStatus;
  className?: string;
}

export function TransportStatusBadge({ status, className }: TransportStatusBadgeProps) {
  const colors: Record<TransportStatus, string> = {
    pending: 'bg-stone-100 text-stone-700 border-stone-200',
    in_transit: 'bg-blue-100 text-blue-700 border-blue-200',
    arrived: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    delivered: 'bg-emerald-600 text-white border-emerald-700',
  };

  return (
    <span
      className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      colors[status],
      className
    )}
    >
      {TRANSPORT_STATUS_LABELS[status]}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: AlertSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      SEVERITY_COLORS[severity],
      className
    )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

interface CurrencyBadgeProps {
  currency: string;
  className?: string;
}

export function CurrencyBadge({ currency, className }: CurrencyBadgeProps) {
  const colors: Record<string, string> = {
    CNY: 'bg-red-50 text-red-700 border-red-200',
    USD: 'bg-green-50 text-green-700 border-green-200',
    EUR: 'bg-blue-50 text-blue-700 border-blue-200',
    GBP: 'bg-purple-50 text-purple-700 border-purple-200',
    JPY: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  return (
    <span
      className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      colors[currency] || 'bg-stone-50 text-stone-700 border-stone-200',
      className
    )}
    >
      {currency}
    </span>
  );
}

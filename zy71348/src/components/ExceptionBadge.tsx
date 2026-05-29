import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { ExceptionType } from '@/types';
import { EXCEPTION_TYPE_LABELS } from '@/types';

interface ExceptionBadgeProps {
  type: ExceptionType;
  resolved: boolean;
}

const typeColors: Record<ExceptionType, string> = {
  missing_field: 'bg-alert-500/10 text-alert-500',
  duplicate: 'bg-orange-500/10 text-orange-600',
  state_invalid: 'bg-purple-500/10 text-purple-600',
  price_anomaly: 'bg-caramel-400/20 text-caramel-500',
};

export function ExceptionBadge({ type, resolved }: ExceptionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-medium ${
        resolved ? 'bg-gray-100 text-gray-500 line-through' : typeColors[type]
      }`}
    >
      {resolved ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      {EXCEPTION_TYPE_LABELS[type]}
    </span>
  );
}

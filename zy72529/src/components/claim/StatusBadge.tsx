import type { RecordStatus, ResultType } from '../../types/claim';
import { STATUS_LABELS, RESULT_TYPE_LABELS } from '../../types/claim';
import { AlertTriangle, CheckCircle, Clock, XCircle, HelpCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: RecordStatus;
  resultType?: ResultType;
}

const statusConfig: Record<RecordStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  pending_import: { bg: 'bg-slate-100', text: 'text-slate-700', icon: Clock },
  pending_review: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
  pending_verify: { bg: 'bg-amber-50', text: 'text-amber-700', icon: HelpCircle },
  conflict: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle },
};

export function StatusBadge({ status, resultType }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon size={12} />
        {STATUS_LABELS[status]}
      </span>
      {resultType && status === 'completed' && (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
          {RESULT_TYPE_LABELS[resultType]}
        </span>
      )}
      {resultType && resultType === 'old_criteria' && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
          <AlertTriangle size={12} />
          含旧口径
        </span>
      )}
    </div>
  );
}

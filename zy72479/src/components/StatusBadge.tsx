import { CaseStatus, ResultType, statusLabels, resultTypeLabels, resultTypeStyles } from '../types';

interface StatusBadgeProps {
  status: CaseStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<CaseStatus, string> = {
    normal: 'bg-success-50 text-success-600 border-success-200',
    pending_review: 'bg-warning-50 text-warning-600 border-warning-200',
    conflict: 'bg-danger-50 text-danger-600 border-danger-200',
    supplemented: 'bg-primary-50 text-primary-600 border-primary-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

interface ResultTypeBadgeProps {
  resultType: ResultType;
}

export function ResultTypeBadge({ resultType }: ResultTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${resultTypeStyles[resultType]}`}
    >
      {resultTypeLabels[resultType]}
    </span>
  );
}

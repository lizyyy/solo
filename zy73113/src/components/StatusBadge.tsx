import type { PlanStatus, Judgment, OperationType } from '../../shared/types';
import { STATUS_LABELS, JUDGMENT_LABELS, OPERATION_LABELS } from '../../shared/types';
import { AlertTriangle, CheckCircle, Clock, FileText, MessageSquare, Gavel, Package, Tag } from 'lucide-react';

interface StatusBadgeProps {
  status: PlanStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isAbnormal = status === 'abnormal';
  
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all ${
        isAbnormal
          ? 'bg-amber-100 text-abnormal border border-amber-300'
          : 'bg-emerald-100 text-normal border border-emerald-300'
      }`}
    >
      {isAbnormal ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <CheckCircle className="w-3 h-3" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

interface JudgmentBadgeProps {
  judgment: Judgment;
}

export function JudgmentBadge({ judgment }: JudgmentBadgeProps) {
  const styles: Record<Judgment, string> = {
    approved: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    rejected: 'bg-red-100 text-red-700 border border-red-300',
    pending: 'bg-slate-100 text-slate-600 border border-slate-300',
  };

  const icons: Record<Judgment, React.ReactNode> = {
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <AlertTriangle className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${styles[judgment]}`}>
      {icons[judgment]}
      {JUDGMENT_LABELS[judgment]}
    </span>
  );
}

interface OperationIconProps {
  type: OperationType;
  className?: string;
}

export function OperationIcon({ type, className = 'w-4 h-4' }: OperationIconProps) {
  const icons: Record<OperationType, React.ReactNode> = {
    create: <FileText className={className} />,
    remark_update: <MessageSquare className={className} />,
    judgment_change: <Gavel className={className} />,
    material_add: <Package className={className} />,
    status_change: <Tag className={className} />,
  };

  return <>{icons[type]}</>;
}

export { OPERATION_LABELS };

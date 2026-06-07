import type { RecordStatus, ConflictStatus, NameReviewStatus } from '@shared/types';

interface StatusBadgeProps {
  status: RecordStatus;
}

export function RecordStatusBadge({ status }: StatusBadgeProps) {
  const config: Record<RecordStatus, { label: string; className: string }> = {
    pending_import: { label: '待导入', className: 'bg-slate-100 text-slate-700' },
    pending_review: { label: '待巡检员复核', className: 'bg-warning-100 text-warning-700' },
    pending_summary: { label: '待更新摘要', className: 'bg-municipal-100 text-municipal-700' },
    completed: { label: '已完成', className: 'bg-success-100 text-success-700' },
  };
  const { label, className } = config[status];
  return <span className={`status-badge ${className}`}>{label}</span>;
}

interface ConflictBadgeProps {
  status?: ConflictStatus;
  hasConflict: boolean;
}

export function ConflictStatusBadge({ status, hasConflict }: ConflictBadgeProps) {
  if (!hasConflict) {
    return <span className="status-badge bg-success-100 text-success-700">无冲突</span>;
  }
  const config: Record<ConflictStatus, { label: string; className: string }> = {
    pending: { label: '冲突待处理', className: 'bg-danger-100 text-danger-700' },
    confirmed: { label: '冲突已确认', className: 'bg-warning-100 text-warning-700' },
    rejected: { label: '冲突已驳回', className: 'bg-slate-100 text-slate-700' },
  };
  const { label, className } = config[status || 'pending'];
  return <span className={`status-badge ${className}`}>{label}</span>;
}

interface NameBadgeProps {
  status?: NameReviewStatus;
  hasNameIssue: boolean;
}

export function NameStatusBadge({ status, hasNameIssue }: NameBadgeProps) {
  if (!hasNameIssue) {
    return <span className="status-badge bg-success-100 text-success-700">名称正常</span>;
  }
  const config: Record<NameReviewStatus, { label: string; className: string }> = {
    pending: { label: '新旧名待复核', className: 'bg-warning-100 text-warning-700' },
    confirmed: { label: '名称已确认', className: 'bg-success-100 text-success-700' },
  };
  const { label, className } = config[status || 'pending'];
  return <span className={`status-badge ${className}`}>{label}</span>;
}

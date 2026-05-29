import { ISSUE_TYPE_LABELS, ISSUE_TYPE_COLORS } from '../../types';
import type { IssueType } from '../../types';
import { AlertTriangle, XCircle, ArrowUpDown } from 'lucide-react';

interface IssueTagProps {
  type: IssueType;
  description?: string;
  showIcon?: boolean;
}

const issueIcons: Record<IssueType, typeof AlertTriangle> = {
  OVERLAP: XCircle,
  SPILL: AlertTriangle,
  SEQUENCE: ArrowUpDown,
};

export function IssueTag({ type, description, showIcon = true }: IssueTagProps) {
  const Icon = issueIcons[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${ISSUE_TYPE_COLORS[type]}`}
      title={description}
    >
      {showIcon && <Icon size={12} />}
      {ISSUE_TYPE_LABELS[type]}
    </span>
  );
}

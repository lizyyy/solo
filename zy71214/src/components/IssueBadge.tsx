import { IssueType, IssueSeverity } from '@/types';
import { ISSUE_TYPE_LABELS, ISSUE_TYPE_COLORS, SEVERITY_LABELS, SEVERITY_COLORS } from '@/constants/purposeCodes';

interface IssueBadgeProps {
  type: IssueType;
  severity?: IssueSeverity;
  showSeverity?: boolean;
}

export const IssueBadge = ({ type, severity, showSeverity = false }: IssueBadgeProps) => {
  const label = ISSUE_TYPE_LABELS[type] || type;
  const colorClass = ISSUE_TYPE_COLORS[type] || 'bg-gray-50 border-gray-200 text-gray-700';

  return (
    <span className="inline-flex items-center gap-1 border rounded px-2 py-0.5 text-xs font-medium">
      <span className={`px-1.5 py-0.5 rounded ${colorClass}`}>{label}</span>
      {showSeverity && severity && (
        <span className={`px-1.5 py-0.5 rounded text-xs ${SEVERITY_COLORS[severity]}`}>
          {SEVERITY_LABELS[severity]}风险
        </span>
      )}
    </span>
  );
};

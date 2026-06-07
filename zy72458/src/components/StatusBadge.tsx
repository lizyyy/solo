import { STATUS_LABELS, STATUS_COLORS, ComplaintStatus } from '../../shared/types';
import { AlertTriangle } from 'lucide-react';

interface Props {
  status: ComplaintStatus;
  isDuplicate?: boolean;
}

export default function StatusBadge({ status, isDuplicate }: Props) {
  return (
    <span className="inline-flex items-center gap-1">
      {isDuplicate && (
        <span title="重复导入">
          <AlertTriangle size={14} className="text-orange-500" />
        </span>
      )}
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}>
        {STATUS_LABELS[status]}
      </span>
    </span>
  );
}

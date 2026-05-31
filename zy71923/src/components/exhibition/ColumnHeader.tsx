import type { ProcessingStatus } from '../../data/types';
import { getStatusDisplayText } from '../../logic/statusClassifier';

interface ColumnHeaderProps {
  status: ProcessingStatus;
  count: number;
}

const statusColors: Record<ProcessingStatus, string> = {
  confirmed: 'text-green-800 border-green-600',
  pending: 'text-red-800 border-red-600',
  'manual-modified': 'text-amber-800 border-amber-600',
};

const statusBgColors: Record<ProcessingStatus, string> = {
  confirmed: 'bg-green-50',
  pending: 'bg-red-50',
  'manual-modified': 'bg-amber-50',
};

export default function ColumnHeader({ status, count }: ColumnHeaderProps) {
  return (
    <div className={`px-4 py-3 rounded-t-lg border-b-2 ${statusBgColors[status]} ${statusColors[status]}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">
          {getStatusDisplayText(status)}
        </h3>
        <span className="font-mono text-sm font-bold">{count}</span>
      </div>
    </div>
  );
}

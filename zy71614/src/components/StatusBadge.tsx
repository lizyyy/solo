import type { TaskStatus, RecordStatus } from '@/types';
import { getStatusLabel, getStatusColor, getRecordStatusLabel, getRecordStatusColor } from '@/utils/format';

interface StatusBadgeProps {
  status: TaskStatus | RecordStatus;
  type?: 'task' | 'record';
}

export default function StatusBadge({ status, type = 'task' }: StatusBadgeProps) {
  const label = type === 'task' ? getStatusLabel(status as TaskStatus) : getRecordStatusLabel(status as RecordStatus);
  const color = type === 'task' ? getStatusColor(status as TaskStatus) : getRecordStatusColor(status as RecordStatus);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

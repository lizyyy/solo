import { TaskStatus, TaskSource, TaskStatusLabels, TaskSourceLabels, TaskStatusColors, TaskSourceColors } from '../types';

interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TaskStatusColors[status]}`}>
      {TaskStatusLabels[status]}
    </span>
  );
}

interface SourceBadgeProps {
  source: TaskSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TaskSourceColors[source]}`}>
      {TaskSourceLabels[source]}
    </span>
  );
}

import { STATUS_COLORS, STATUS_LABELS, SOURCE_LABELS, ACTION_LABELS } from '@/types';
import type { RecordStatus, RecordSource, OperationAction } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses}`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

interface SourceBadgeProps {
  source: RecordSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const colors: Record<RecordSource, string> = {
    api_doc: '#8B5CF6',
    manual: '#F59E0B',
    call_log: '#10B981',
  };
  const color = colors[source];
  const label = SOURCE_LABELS[source];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

interface ActionBadgeProps {
  action: OperationAction;
}

export function ActionBadge({ action }: ActionBadgeProps) {
  const colors: Record<OperationAction, string> = {
    import: '#06B6D4',
    review: '#8B5CF6',
    modify: '#F59E0B',
    export: '#10B981',
    permission_change: '#EC4899',
    create: '#6366F1',
  };
  const color = colors[action];
  const label = ACTION_LABELS[action];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  );
}

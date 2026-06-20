import type { AnomalyType, ProcessingStatus } from '@/types';
import { ANOMALY_TYPE_LABELS, STATUS_LABELS } from '@/types';
import {
  Ruler,
  GitBranch,
  FileX2,
  Calculator,
  Clock,
  Eye,
  CheckCircle2,
  EyeOff,
} from 'lucide-react';

export function AnomalyTypeTag({ type, count }: { type: AnomalyType; count?: number }) {
  const config = {
    unit_missing: { cls: 'tag-unit', Icon: Ruler },
    boundary_sample: { cls: 'tag-boundary', Icon: GitBranch },
    bad_data: { cls: 'tag-bad', Icon: FileX2 },
    calculation_error: { cls: 'tag-calc', Icon: Calculator },
  };
  const { cls, Icon } = config[type];

  return (
    <span className={cls}>
      <Icon className="w-3 h-3 mr-1" />
      {ANOMALY_TYPE_LABELS[type]}
      {count !== undefined && (
        <span className="ml-1 font-semibold">{count}</span>
      )}
    </span>
  );
}

export function StatusTag({ status }: { status: ProcessingStatus }) {
  const config = {
    pending: { cls: 'tag-pending', Icon: Clock },
    reviewing: { cls: 'tag bg-blue-50 text-blue-700 border border-blue-200', Icon: Eye },
    resolved: { cls: 'tag-resolved', Icon: CheckCircle2 },
    ignored: { cls: 'tag bg-gray-50 text-gray-600 border border-gray-200', Icon: EyeOff },
  };
  const { cls, Icon } = config[status];

  return (
    <span className={cls}>
      <Icon className="w-3 h-3 mr-1" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const ANOMALY_TYPE_ICONS = {
  unit_missing: Ruler,
  boundary_sample: GitBranch,
  bad_data: FileX2,
  calculation_error: Calculator,
};

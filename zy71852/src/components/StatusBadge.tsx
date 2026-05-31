import type { StepStatus, ExperimentStatus, AnomalyType } from '@/types';
import { statusLabels, experimentStatusLabels } from '@/types';

interface StepStatusBadgeProps {
  status: StepStatus;
  skipReason?: string;
  skipSource?: string;
}

export function StepStatusBadge({ status, skipReason, skipSource }: StepStatusBadgeProps) {
  const label = statusLabels[status];

  return (
    <span
      className="group relative inline-flex items-center gap-1.5"
      title={skipReason}
    >
      <span className={`w-2 h-2 rounded-full ${label.color}`} />
      <span className="text-xs font-medium text-neutral-700">{label.label}</span>
      {status === 'skipped' && skipReason && (
        <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:block w-64 p-2 bg-neutral-800 text-white text-xs rounded shadow-lg">
          <div className="font-medium mb-1">跳过原因：</div>
          <div className="text-neutral-200">{skipReason}</div>
          {skipSource && (
            <div className="mt-1 text-neutral-400">来源：{skipSource}</div>
          )}
        </div>
      )}
    </span>
  );
}

interface ExperimentStatusBadgeProps {
  status: ExperimentStatus;
}

export function ExperimentStatusBadge({ status }: ExperimentStatusBadgeProps) {
  const label = experimentStatusLabels[status];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${label.color}`} />
      <span className="text-xs font-medium text-neutral-700">{label.label}</span>
    </span>
  );
}

interface AnomalyTypeBadgeProps {
  type: AnomalyType;
}

export function AnomalyTypeBadge({ type }: AnomalyTypeBadgeProps) {
  const configs: Record<AnomalyType, { label: string; color: string }> = {
    step_skip: { label: '步骤跳过', color: 'bg-red-100 text-red-700 border-red-200' },
    conclusion_diff: { label: '结论差异', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    timing_diff: { label: '时序差异', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    missing_data: { label: '数据缺失', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  };

  const config = configs[type];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${config.color}`}
    >
      {config.label}
    </span>
  );
}

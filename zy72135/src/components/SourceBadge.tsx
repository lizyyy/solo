import { sourceLabels, type RecordSource } from '../../shared/types';

interface SourceBadgeProps {
  source: RecordSource;
}

const sourceStyles: Record<RecordSource, string> = {
  stage_channel: 'bg-slate-100 text-slate-700 border border-slate-200',
  manual: 'bg-purple-100 text-purple-700 border border-purple-200',
  imported_old: 'bg-orange-100 text-orange-700 border border-orange-200',
};

export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <span className={`status-badge ${sourceStyles[source]}`}>
      {sourceLabels[source]}
    </span>
  );
}

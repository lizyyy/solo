import type { Severity, AnomalyType } from '@/types';
import { anomalyTypeLabels, severityLabels } from '@/utils/anomalyDetector';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const styles = {
    high: 'bg-alert-orange/15 text-alert-orange border-alert-orange/30',
    medium: 'bg-alert-yellow/15 text-amber-600 border-alert-yellow/30',
    low: 'bg-alert-blue/15 text-alert-blue border-alert-blue/30',
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`badge border ${styles[severity]} ${sizeClasses} font-medium`}>
      {severityLabels[severity]}
    </span>
  );
}

interface AnomalyTypeBadgeProps {
  type: AnomalyType;
}

export function AnomalyTypeBadge({ type }: AnomalyTypeBadgeProps) {
  const styles: Record<AnomalyType, string> = {
    unit_mismatch: 'bg-ocean-100 text-ocean-700 border-ocean-200',
    caliber_change: 'bg-purple-50 text-purple-700 border-purple-200',
    time_mismatch: 'bg-amber-50 text-amber-700 border-amber-200',
    value_abnormal: 'bg-red-50 text-red-700 border-red-200',
    missing_data: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <span className={`badge border ${styles[type]} font-medium`}>
      {anomalyTypeLabels[type]}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'confirmed' | 'pending';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    confirmed: 'bg-alert-green/15 text-alert-green border-alert-green/30',
    pending: 'bg-alert-yellow/15 text-amber-600 border-alert-yellow/30',
  };

  const labels = {
    confirmed: '已确认',
    pending: '待补证据',
  };

  return (
    <span className={`badge border ${styles[status]} font-medium`}>
      {labels[status]}
    </span>
  );
}

interface SourceTypeBadgeProps {
  source: 'lab_result' | 'late_attachment' | 'verbal_note';
}

export function SourceTypeBadge({ source }: SourceTypeBadgeProps) {
  const styles = {
    lab_result: 'bg-ocean-100 text-ocean-700 border-ocean-200',
    late_attachment: 'bg-orange-50 text-orange-700 border-orange-200',
    verbal_note: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const labels = {
    lab_result: '实验室结果',
    late_attachment: '晚到附件',
    verbal_note: '口头说明',
  };

  return (
    <span className={`badge border ${styles[source]} font-medium`}>
      {labels[source]}
    </span>
  );
}

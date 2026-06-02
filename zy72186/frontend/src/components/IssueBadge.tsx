import type { Sample } from '../types';
import { getConflictTypeLabel, getConflictTypeColor } from '../utils/format';

interface IssueBadgeProps {
  sample: Sample;
  showAll?: boolean;
}

export default function IssueBadge({ sample, showAll = false }: IssueBadgeProps) {
  const issues: { type: string; label: string; color: string }[] = [];

  if (sample.isDuplicate) {
    issues.push({
      type: 'duplicate',
      label: '重复样本',
      color: 'bg-purple-100 text-purple-800',
    });
  }

  if (sample.isMissingRef) {
    issues.push({
      type: 'missing_ref',
      label: getConflictTypeLabel('missing_ref'),
      color: getConflictTypeColor('missing_ref'),
    });
  }

  if (sample.hasManualOverride) {
    issues.push({
      type: 'manual_override',
      label: getConflictTypeLabel('manual_override'),
      color: getConflictTypeColor('manual_override'),
    });
  }

  if (sample.hasModelImportConflict) {
    issues.push({
      type: 'model_import_mismatch',
      label: getConflictTypeLabel('model_import_mismatch'),
      color: getConflictTypeColor('model_import_mismatch'),
    });
  }

  if (sample.modelConfidence !== null && sample.modelThreshold !== null && sample.modelConfidence < sample.modelThreshold) {
    issues.push({
      type: 'low_confidence',
      label: '低置信度',
      color: 'bg-gray-100 text-gray-800',
    });
  }

  if (issues.length === 0) return null;

  const displayIssues = showAll ? issues : issues.slice(0, 2);
  const hiddenCount = issues.length - displayIssues.length;

  return (
    <div className="flex flex-wrap gap-1">
      {displayIssues.map(issue => (
        <span key={issue.type} className={`badge ${issue.color}`}>
          {issue.label}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="badge bg-gray-100 text-gray-600">+{hiddenCount}</span>
      )}
    </div>
  );
}

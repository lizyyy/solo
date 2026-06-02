import type { ReviewStatus, ReviewDecision } from '../types';

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusLabel(status: ReviewStatus): string {
  const labels: Record<ReviewStatus, string> = {
    pending: '待复核',
    approved: '已通过',
    rejected: '已驳回',
    conflict: '存在冲突',
    need_review: '需人工复核',
  };
  return labels[status];
}

export function getStatusColor(status: ReviewStatus): string {
  const colors: Record<ReviewStatus, string> = {
    pending: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    conflict: 'bg-orange-100 text-orange-800',
    need_review: 'bg-yellow-100 text-yellow-800',
  };
  return colors[status];
}

export function getDecisionLabel(decision: ReviewDecision): string {
  const labels: Record<ReviewDecision, string> = {
    approve: '通过',
    reject: '驳回',
    escalate: '升级复核',
  };
  return labels[decision];
}

export function getDecisionColor(decision: ReviewDecision): string {
  const colors: Record<ReviewDecision, string> = {
    approve: 'text-green-600',
    reject: 'text-red-600',
    escalate: 'text-yellow-600',
  };
  return colors[decision];
}

export function getConflictTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    missing_ref: '缺少引用',
    manual_override: '人工改判',
    model_import_mismatch: '模型与导入冲突',
  };
  return labels[type] || type;
}

export function getConflictTypeColor(type: string): string {
  const colors: Record<string, string> = {
    missing_ref: 'bg-yellow-100 text-yellow-800',
    manual_override: 'bg-red-100 text-red-800',
    model_import_mismatch: 'bg-orange-100 text-orange-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

export function formatConfidence(confidence: number | null): string {
  if (confidence === null) return '-';
  return `${(confidence * 100).toFixed(1)}%`;
}



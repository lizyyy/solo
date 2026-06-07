import type { CheckStatus, SelfCheckStatus } from '../types';

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusText = (status: CheckStatus): string => {
  const statusMap: Record<CheckStatus, string> = {
    pending_import: '待导入',
    imported: '已导入',
    pending_review: '待复核',
    conflict_detected: '检测到冲突',
    review_confirmed: '已确认',
    review_rejected: '已驳回',
    pending_recheck: '待重检',
    rechecked: '已重检',
    completed: '已完成',
  };
  return statusMap[status] || status;
};

export const getStatusClass = (status: CheckStatus): string => {
  if (status === 'conflict_detected' || status === 'review_rejected') {
    return 'status-conflict';
  }
  if (status === 'completed' || status === 'rechecked' || status === 'review_confirmed') {
    return 'status-completed';
  }
  if (status === 'pending_review' || status === 'pending_recheck' || status === 'imported') {
    return 'status-pending';
  }
  return 'status-review';
};

export const getSelfCheckClass = (status: SelfCheckStatus): string => {
  const classMap: Record<SelfCheckStatus, string> = {
    pass: 'check-pass',
    warning: 'check-warning',
    error: 'check-error',
    pending: 'check-pending',
  };
  return classMap[status];
};

export const getSelfCheckText = (status: SelfCheckStatus): string => {
  const textMap: Record<SelfCheckStatus, string> = {
    pass: '✓',
    warning: '!',
    error: '✕',
    pending: '?',
  };
  return textMap[status];
};

export const getSelfCheckTypeName = (type: string): string => {
  const typeMap: Record<string, string> = {
    duplicate_import: '重复导入检查',
    model_version_changed: '模型版本变更检查',
    recalc_after_supplement: '补录后重算检查',
    export_consistency: '导出一致性检查',
  };
  return typeMap[type] || type;
};

export const getScoreClass = (score: number): string => {
  if (score >= 0.9) return 'score-high';
  if (score >= 0.7) return 'score-medium';
  return 'score-low';
};

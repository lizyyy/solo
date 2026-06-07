export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function calculateScore(illumination: number, hasRamp: boolean): number {
  let baseScore = Math.min(100, Math.max(0, illumination * 2));
  if (hasRamp) {
    baseScore = Math.max(0, baseScore - 15);
  }
  return Math.round(baseScore);
}

export function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    confirmed: '已确认',
    rejected: '已驳回',
    need_review: '需复核'
  };
  return statusMap[status] || status;
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    pending: 'default',
    processing: 'processing',
    confirmed: 'success',
    rejected: 'error',
    need_review: 'warning'
  };
  return colorMap[status] || 'default';
}

export function getConflictTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    sampling_vs_complaint: '采样与投诉矛盾',
    duplicate_import: '重复导入',
    ramp_score_unchanged: '坡道补录评分未变'
  };
  return typeMap[type] || type;
}

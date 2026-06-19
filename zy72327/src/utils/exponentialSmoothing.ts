export function parseNumericValue(v: number | string): number {
  if (typeof v === 'number') return v;
  if (v.endsWith('%')) {
    return parseFloat(v) / 100;
  }
  return parseFloat(v);
}

export function formatValue(v: number | string, format: 'decimal' | 'percentage' | 'mixed'): string {
  const num = typeof v === 'number' ? v : parseNumericValue(v);
  if (format === 'percentage') {
    return `${(num * 100).toFixed(2)}%`;
  }
  if (format === 'decimal') {
    return num.toFixed(4);
  }
  if (typeof v === 'string' && v.endsWith('%')) {
    return v;
  }
  return num.toFixed(4);
}

export function detectMixedFormat(records: any[]): number {
  return records.filter(r => {
    const values = [r.alpha, r.beta, r.gamma];
    const hasPercentage = values.some(v => typeof v === 'string' && v.endsWith('%'));
    const hasDecimal = values.some(v => typeof v === 'number' || (typeof v === 'string' && !v.endsWith('%')));
    return hasPercentage && hasDecimal;
  }).length;
}

export function getStatusColor(status: 'pass' | 'warning' | 'fail' | 'pending'): string {
  const colors: Record<'pass' | 'warning' | 'fail' | 'pending', string> = {
    pass: 'text-green-600 bg-green-50',
    warning: 'text-amber-600 bg-amber-50',
    fail: 'text-red-600 bg-red-50',
    pending: 'text-gray-500 bg-gray-50',
  };
  return colors[status];
}

export function getReviewStatusText(status: 'pending_review' | 'reviewed' | 'normal'): string {
  const texts = {
    pending_review: '待复核',
    reviewed: '已复核',
    normal: '正常'
  };
  return texts[status];
}

export function getStepName(step: number): string {
  const names: Record<number, string> = {
    1: '参数调试表第一次导入',
    2: '数据分析师小祁补看手算反例',
    3: '计算明细更新'
  };
  return names[step] || `步骤 ${step}`;
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

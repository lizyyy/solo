export function formatCurrency(amount: number, symbol: string = '¥'): string {
  return symbol + amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatPercent(value: number, decimals: number = 1): string {
  return (value * 100).toFixed(decimals) + '%';
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatBidType(type: string): string {
  const map: Record<string, string> = {
    floor: '现场',
    phone: '电话',
    online: '网络',
    absentee: '委托',
  };
  return map[type] || type;
}

export function formatSeverity(severity: string): string {
  const map: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '严重',
  };
  return map[severity] || severity;
}

export function formatScenario(scenario: string): string {
  const map: Record<string, string> = {
    conservative: '保守',
    neutral: '中性',
    optimistic: '乐观',
  };
  return map[scenario] || scenario;
}

export function formatAnomalyType(type: string): string {
  const map: Record<string, string> = {
    sample_size: '样本量',
    unsold_cost: '流拍成本',
    commission_tier: '佣金阶梯',
    data_quality: '数据质量',
  };
  return map[type] || type;
}

export function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    low: 'text-emerald-700 bg-emerald-50',
    medium: 'text-amber-700 bg-amber-50',
    high: 'text-orange-700 bg-orange-50',
    critical: 'text-red-700 bg-red-50',
  };
  return map[severity] || 'text-slate-700 bg-slate-50';
}

export function getSeverityBorderColor(severity: string): string {
  const map: Record<string, string> = {
    low: 'border-l-emerald-500',
    medium: 'border-l-amber-500',
    high: 'border-l-orange-500',
    critical: 'border-l-red-500',
  };
  return map[severity] || 'border-l-slate-500';
}

export function formatNumber(num: number, decimals = 2): string {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(num: number): string {
  return num.toLocaleString('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatPercent(num: number, decimals = 2): string {
  return `${num >= 0 ? '+' : ''}${num.toFixed(decimals)}%`;
}

export function formatPnL(num: number): string {
  const formatted = formatCurrency(Math.abs(num));
  return num >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function getPnLColor(num: number): string {
  if (num > 0) return 'text-trader-green';
  if (num < 0) return 'text-trader-red';
  return 'text-gray-400';
}

export function getPnLBgColor(num: number): string {
  if (num > 0) return 'bg-trader-green/10';
  if (num < 0) return 'bg-trader-red/10';
  return 'bg-gray-500/10';
}

export function getGreekLabel(key: string): string {
  const labels: Record<string, string> = {
    delta: 'Δ Delta',
    gamma: 'Γ Gamma',
    vega: 'V Vega',
    theta: 'Θ Theta',
    rho: 'P Rho',
  };
  return labels[key] || key;
}

export function getGreekUnit(key: string): string {
  const units: Record<string, string> = {
    delta: '',
    gamma: '',
    vega: '',
    theta: '/天',
    rho: '',
  };
  return units[key] || '';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: 'text-blue-400 bg-blue-400/10',
    medium: 'text-warning-orange bg-warning-orange/10',
    high: 'text-trader-red bg-trader-red/20',
    critical: 'text-white bg-trader-red animate-pulse',
  };
  return colors[severity] || 'text-gray-400';
}

export function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '严重',
  };
  return labels[severity] || severity;
}

export function getRatingLabel(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function getRatingColor(score: number): string {
  if (score >= 90) return 'text-yellow-400';
  if (score >= 80) return 'text-trader-green';
  if (score >= 70) return 'text-blue-400';
  if (score >= 60) return 'text-warning-orange';
  return 'text-trader-red';
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    position: '头寸',
    market: '行情',
    margin: '保证金',
    fee: '费用',
    target: '目标',
  };
  return labels[category] || category;
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    position: 'text-trader-green bg-trader-green/20',
    market: 'text-warning-orange bg-warning-orange/20',
    margin: 'text-trader-red bg-trader-red/20',
    fee: 'text-highlight-blue bg-highlight-blue/20',
    target: 'text-highlight-yellow bg-highlight-yellow/20',
  };
  return colors[category] || 'text-bloomberg-muted bg-bloomberg-border/30';
}

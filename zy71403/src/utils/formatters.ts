export function formatCurrency(value: number, decimals: number = 2): string {
  if (value === 0 && decimals === 4) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'decimal',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatLargeNumber(value: number): string {
  if (value >= 100000000) {
    return `${formatCurrency(value / 100000000, 2)}亿`;
  }
  if (value >= 10000) {
    return `${formatCurrency(value / 10000, 2)}万`;
  }
  return formatCurrency(value, 2);
}

export function formatShares(value: number): string {
  return formatCurrency(value, 2);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getFundName(fundId: string, funds: { fundId: string; fundName: string }[]): string {
  const fund = funds.find(f => f.fundId === fundId);
  return fund ? fund.fundName : fundId;
}

export function getFundCode(fundId: string, funds: { fundId: string; fundCode: string }[]): string {
  const fund = funds.find(f => f.fundId === fundId);
  return fund ? fund.fundCode : '-';
}

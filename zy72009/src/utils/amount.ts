export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateDiffPercent(amount1: number, amount2: number): number {
  if (amount2 === 0) return 100;
  return Math.abs((amount1 - amount2) / amount2) * 100;
}

export function parseAmount(str: string): number {
  const cleaned = str.replace(/[¥,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

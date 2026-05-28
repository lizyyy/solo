import type { IndexComponent, Holding, Warning } from '../types';

export function calculateTrackingError(
  portfolioReturns: number[],
  indexReturns: number[]
): number {
  if (portfolioReturns.length < 2 || portfolioReturns.length !== indexReturns.length) {
    return 0;
  }
  
  const diffs = portfolioReturns.map((r, i) => r - indexReturns[i]);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / diffs.length;
  
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function calculateTotalAssets(holdings: Holding[], cash: number): number {
  const holdingValue = holdings.reduce((sum, h) => {
    return sum + h.quantity * h.currentPrice;
  }, 0);
  return holdingValue + cash;
}

export function calculatePortfolioWeights(holdings: Holding[], totalAssets: number): Map<string, number> {
  const weights = new Map<string, number>();
  holdings.forEach(h => {
    const value = h.quantity * h.currentPrice;
    weights.set(h.code, value / totalAssets);
  });
  return weights;
}

export function checkCashWarning(cash: number, totalAssets: number): Warning | null {
  if (totalAssets <= 0) return null;
  
  const cashRatio = cash / totalAssets;
  if (cashRatio > 0.1) {
    return {
      id: Date.now().toString(),
      type: 'cash_excess',
      severity: cashRatio > 0.2 ? 'critical' : 'warning',
      message: `现金比例过高: ${(cashRatio * 100).toFixed(1)}%`,
      suggestion: '建议将现金投入成分股以减小跟踪误差',
      timestamp: Date.now()
    };
  }
  return null;
}

export function checkSuspensionWarning(
  holdings: Holding[],
  indexComponents: IndexComponent[]
): Warning | null {
  const suspendedHoldings = holdings.filter(h => h.isSuspended);
  if (suspendedHoldings.length === 0) return null;

  const suspendedInIndex = indexComponents.filter(c => c.isSuspended);
  const suspendedCodes = new Set(suspendedInIndex.map(c => c.code));
  
  const mismatchedSuspensions = suspendedHoldings.filter(h => !suspendedCodes.has(h.code));
  
  if (mismatchedSuspensions.length > 0) {
    return {
      id: Date.now().toString(),
      type: 'suspension_mismatch',
      severity: 'warning',
      message: `持有停牌股票: ${mismatchedSuspensions.map(h => h.name).join(', ')}`,
      suggestion: '考虑用流动性好的同类股票替代停牌股',
      timestamp: Date.now()
    };
  }
  return null;
}

export function checkErrorAccumulationWarning(errorHistory: number[]): Warning | null {
  if (errorHistory.length < 5) return null;
  
  const recentErrors = errorHistory.slice(-5);
  const increasing = recentErrors.every((e, i) => i === 0 || e >= recentErrors[i - 1]);
  
  if (increasing && recentErrors[recentErrors.length - 1] > 0.03) {
    return {
      id: Date.now().toString(),
      type: 'error_accumulation',
      severity: 'critical',
      message: `跟踪误差连续上升，当前: ${(recentErrors[recentErrors.length - 1] * 100).toFixed(2)}%`,
      suggestion: '误差持续扩大，请检查持仓权重是否偏离指数',
      timestamp: Date.now()
    };
  }
  return null;
}

export function calculateWeightDeviation(
  holdings: Holding[],
  indexComponents: IndexComponent[],
  totalAssets: number
): Map<string, number> {
  const deviations = new Map<string, number>();
  const portfolioWeights = calculatePortfolioWeights(holdings, totalAssets);
  
  indexComponents.forEach(component => {
    const portfolioWeight = portfolioWeights.get(component.code) || 0;
    const indexWeight = component.weight / 100;
    deviations.set(component.code, portfolioWeight - indexWeight);
  });
  
  return deviations;
}

export function generateRandomPriceChange(): number {
  const mean = 0.001;
  const std = 0.02;
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

export function calculateReturn(history: number[]): number {
  if (history.length < 2) return 0;
  const current = history[history.length - 1];
  const previous = history[history.length - 2];
  return (current - previous) / previous;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

import type { RiskLevel } from '../../types/tour';

export function calculateBoxOfficeRisk(
  predicted: number,
  actual: number,
  threshold: number = 0.7
): RiskLevel {
  if (predicted <= 0) return 'high';
  const ratio = actual / predicted;
  if (ratio >= threshold) return 'low';
  if (ratio >= threshold * 0.6) return 'medium';
  return 'high';
}

export function calculateInventoryRisk(
  currentStock: number,
  dailySalesRate: number,
  remainingDays: number
): RiskLevel {
  if (dailySalesRate <= 0 || remainingDays <= 0) {
    return currentStock > 0 ? 'low' : 'high';
  }
  const projectedDaysCovered = currentStock / dailySalesRate;
  const neededStock = dailySalesRate * remainingDays;

  if (projectedDaysCovered >= remainingDays * 2) return 'high';
  if (projectedDaysCovered >= remainingDays * 1.2) return 'low';
  if (projectedDaysCovered >= remainingDays * 0.8) return 'medium';
  if (currentStock >= neededStock * 0.5) return 'medium';
  return 'high';
}

export function calculateRouteRisk(
  actualDistance: number,
  optimalDistance: number
): RiskLevel {
  if (optimalDistance <= 0) return actualDistance > 0 ? 'high' : 'low';
  const ratio = actualDistance / optimalDistance;
  if (ratio <= 1.1) return 'low';
  if (ratio <= 1.3) return 'medium';
  return 'high';
}

export function calculateCashFlowRisk(
  currentCash: number,
  projectedExpenses: number[]
): RiskLevel {
  const totalExpenses = projectedExpenses.reduce((sum, exp) => sum + Math.max(0, exp), 0);
  if (totalExpenses <= 0) return currentCash >= 0 ? 'low' : 'high';
  const ratio = currentCash / totalExpenses;
  if (ratio >= 1.5) return 'low';
  if (ratio >= 1.0) return 'medium';
  return 'high';
}

export function calculateOverallRiskIndex(
  risks: { type: string; level: string }[]
): number {
  if (risks.length === 0) return 0;

  const levelScores: Record<string, number> = {
    low: 20,
    medium: 50,
    high: 80,
  };

  const typeWeights: Record<string, number> = {
    cashflow: 1.5,
    box_office: 1.2,
    inventory: 1.0,
    route: 0.8,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const risk of risks) {
    const score = levelScores[risk.level.toLowerCase()] ?? 50;
    const weight = typeWeights[risk.type] ?? 1.0;
    weightedScore += score * weight;
    totalWeight += weight;
  }

  const rawIndex = totalWeight > 0 ? weightedScore / totalWeight : 0;
  return Math.min(100, Math.max(0, Math.round(rawIndex)));
}

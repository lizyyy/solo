import { AnomalyType, FormulaComponent, Pigment } from '../types';

export function checkRatioComplete(formula: FormulaComponent[]): { complete: boolean; total: number; diff: number } {
  const total = formula.reduce((sum, c) => sum + c.ratio, 0);
  const diff = 100 - total;
  return {
    complete: Math.abs(diff) <= 1,
    total,
    diff,
  };
}

export function checkLightfastness(level: number | null): boolean {
  return level !== null && level >= 1 && level <= 8;
}

export function checkCostAbnormal(cost: number, allCosts: number[]): { abnormal: boolean; deviation: number; mean: number } {
  if (allCosts.length === 0) {
    return { abnormal: false, deviation: 0, mean: 0 };
  }
  
  const mean = allCosts.reduce((a, b) => a + b, 0) / allCosts.length;
  const deviation = ((cost - mean) / mean) * 100;
  
  return {
    abnormal: Math.abs(deviation) > 30,
    deviation,
    mean,
  };
}

export function checkDataMissing(pigment: Partial<Pigment>): boolean {
  return !pigment.name || !pigment.code || !pigment.colorHex;
}

export function detectAnomalies(
  pigment: Pigment,
  allPigments: Pigment[]
): { anomalies: AnomalyType[]; details: Record<string, unknown> } {
  const anomalies: AnomalyType[] = [];
  const details: Record<string, unknown> = {};

  const ratioCheck = checkRatioComplete(pigment.formula);
  if (!ratioCheck.complete) {
    anomalies.push('ratio_incomplete');
    details.ratio = { total: ratioCheck.total, diff: ratioCheck.diff };
  }

  if (!checkLightfastness(pigment.lightfastness)) {
    anomalies.push('lightfastness_missing');
  }

  const allCosts = allPigments.filter(p => p.id !== pigment.id).map(p => p.cost);
  const costCheck = checkCostAbnormal(pigment.cost, allCosts.length > 0 ? allCosts : [pigment.cost]);
  if (costCheck.abnormal) {
    anomalies.push('cost_abnormal');
    details.cost = { deviation: costCheck.deviation, mean: costCheck.mean };
  }

  if (checkDataMissing(pigment)) {
    anomalies.push('data_missing');
  }

  return { anomalies, details };
}

export function determineStatus(anomalies: AnomalyType[]): 'processed' | 'pending' | 'rejected' {
  if (anomalies.length === 0) {
    return 'processed';
  }
  if (anomalies.includes('data_missing')) {
    return 'rejected';
  }
  return 'pending';
}

import { Batch, TemperatureCurve, Formula, RiskAssessment } from '../types';

export function calculateDeltaE(
  target: { L: number; a: number; b: number },
  measured: { L: number; a: number; b: number }
): number {
  const dL = measured.L - target.L;
  const da = measured.a - target.a;
  const db = measured.b - target.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function calculateTemperatureDeviation(
  targetCurve: Array<{ time: number; temperature: number }>,
  actualCurve: Array<{ time: number; temperature: number }>
): number {
  if (targetCurve.length === 0 || actualCurve.length === 0) {
    return 0;
  }

  let totalDeviation = 0;
  let count = 0;

  const maxTime = Math.max(
    targetCurve[targetCurve.length - 1].time,
    actualCurve[actualCurve.length - 1].time
  );

  for (let t = 0; t <= maxTime; t += 1) {
    const targetTemp = interpolateTemperature(targetCurve, t);
    const actualTemp = interpolateTemperature(actualCurve, t);
    
    if (targetTemp !== null && actualTemp !== null) {
      totalDeviation += Math.abs(actualTemp - targetTemp);
      count++;
    }
  }

  return count > 0 ? totalDeviation / count : 0;
}

function interpolateTemperature(
  curve: Array<{ time: number; temperature: number }>,
  time: number
): number | null {
  for (let i = 0; i < curve.length - 1; i++) {
    const p1 = curve[i];
    const p2 = curve[i + 1];
    
    if (time >= p1.time && time <= p2.time) {
      const ratio = (time - p1.time) / (p2.time - p1.time);
      return p1.temperature + ratio * (p2.temperature - p1.temperature);
    }
  }
  
  if (time < curve[0].time) return curve[0].temperature;
  if (time > curve[curve.length - 1].time) return curve[curve.length - 1].temperature;
  
  return null;
}

export function detectMissingChemicals(
  targetFormula: Array<{ chemicalName: string; dosage: number; unit: string }>,
  actualFormula: Array<{ chemicalName: string; dosage: number; unit: string; added: boolean }>
): string[] {
  const missing: string[] = [];
  const actualSet = new Set(
    actualFormula.filter(c => c.added).map(c => c.chemicalName.toLowerCase())
  );

  for (const target of targetFormula) {
    if (!actualSet.has(target.chemicalName.toLowerCase())) {
      missing.push(target.chemicalName);
    }
  }

  return missing;
}

export function calculateReworkPriority(
  deltaE: number,
  temperatureDeviation: number,
  missingChemicalsCount: number
): number {
  let score = 0;

  if (deltaE > 5) score += 30;
  else if (deltaE > 3) score += 20;
  else if (deltaE > 1) score += 10;

  if (temperatureDeviation > 10) score += 25;
  else if (temperatureDeviation > 5) score += 15;
  else if (temperatureDeviation > 2) score += 5;

  score += missingChemicalsCount * 20;

  return Math.min(score, 100);
}

export function determineRiskLevel(reworkPriority: number): RiskAssessment['riskLevel'] {
  if (reworkPriority >= 75) return 'critical';
  if (reworkPriority >= 50) return 'high';
  if (reworkPriority >= 25) return 'medium';
  return 'low';
}

export function performRiskAssessment(
  batch: Batch,
  temperatureCurve?: TemperatureCurve,
  formula?: Formula
): RiskAssessment {
  const deltaE = batch.deltaE ?? 0;
  const tempDeviation = temperatureCurve?.temperatureDeviation ?? 0;
  const missingCount = formula?.missingChemicals.length ?? 0;
  
  const reworkPriority = calculateReworkPriority(deltaE, tempDeviation, missingCount);
  const riskLevel = determineRiskLevel(reworkPriority);

  return {
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    customerName: batch.customerName,
    deltaE,
    temperatureDeviation: tempDeviation,
    missingChemicalsCount: missingCount,
    reworkPriority,
    riskLevel
  };
}

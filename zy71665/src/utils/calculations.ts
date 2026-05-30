import type { MeasurementRecord, CalculationResult, PowerUnit, LengthUnit } from '@/types';

export function mwToDbm(mw: number): number {
  if (mw <= 0) return -Infinity;
  return 10 * Math.log10(mw);
}

export function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

export function normalizePowerToDbm(value: number, unit: PowerUnit): number {
  if (unit === 'mW') return mwToDbm(value);
  return value;
}

export function normalizeLengthToKm(value: number, unit: LengthUnit): number {
  if (unit === 'm') return value / 1000;
  return value;
}

export function calculateLoss(record: MeasurementRecord): CalculationResult {
  const pinDbm = normalizePowerToDbm(record.inputPower, record.powerUnit);
  const poutDbm = normalizePowerToDbm(record.outputPower, record.powerUnit);
  const lossDB = pinDbm - poutDbm;
  const lengthKm = normalizeLengthToKm(record.fiberLength, record.lengthUnit);
  const lossPerKm = lengthKm > 0 ? lossDB / lengthKm : Infinity;
  const connectorLoss = record.connectorCount * 0.5;
  const totalLoss = lossDB + connectorLoss;

  return {
    id: crypto.randomUUID(),
    recordId: record.id,
    lossDB: Math.round(lossDB * 1000) / 1000,
    lossPerKm: Math.round(lossPerKm * 1000) / 1000,
    connectorLoss: Math.round(connectorLoss * 1000) / 1000,
    totalLoss: Math.round(totalLoss * 1000) / 1000,
    calculatedAt: new Date().toISOString(),
  };
}

export function calculateBatchLosses(records: MeasurementRecord[]): CalculationResult[] {
  return records.map(calculateLoss);
}

export function computeStats(results: CalculationResult[]) {
  const valid = results.filter((r) => r.lossPerKm !== Infinity && r.lossPerKm !== -Infinity);
  if (valid.length === 0) {
    return { avg: 0, max: 0, min: 0, count: 0, anomalyRate: 0 };
  }
  const lossValues = valid.map((r) => r.lossPerKm);
  const sum = lossValues.reduce((a, b) => a + b, 0);
  const anomalyCount = results.length - valid.length;
  return {
    avg: Math.round((sum / valid.length) * 1000) / 1000,
    max: Math.round(Math.max(...lossValues) * 1000) / 1000,
    min: Math.round(Math.min(...lossValues) * 1000) / 1000,
    count: results.length,
    anomalyRate: results.length > 0 ? Math.round((anomalyCount / results.length) * 1000) / 10 : 0,
  };
}

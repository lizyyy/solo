import type { TensionRecord, ProcessingStatus, BeltThreshold } from "../types.js";

export interface ThresholdConfig {
  upperLimit: number;
  lowerLimit: number;
  unit: string;
}

export function checkThreshold(
  value: number,
  config: ThresholdConfig
): boolean {
  return value > config.upperLimit || value < config.lowerLimit;
}

export function getThresholdForRecord(
  record: TensionRecord,
  beltThresholds: BeltThreshold[],
  fallback: ThresholdConfig
): ThresholdConfig {
  const found = beltThresholds.find(
    (t) => t.beltId === record.beltId && t.unit === record.unit
  );
  if (found) {
    return {
      upperLimit: found.upperLimit,
      lowerLimit: found.lowerLimit,
      unit: found.unit,
    };
  }
  return fallback;
}

export function processRecords(
  rawRecords: TensionRecord[],
  config: ThresholdConfig,
  beltThresholds?: BeltThreshold[]
): TensionRecord[] {
  const avg = computeAverage(rawRecords);
  const thresholds = beltThresholds ?? [];

  return rawRecords.map((record) => {
    const recConfig = getThresholdForRecord(record, thresholds, config);
    const isOver = checkThreshold(record.tensionValue, recConfig);
    const nearAvg = Math.abs(record.tensionValue - avg) < avg * 0.05;
    const avgMasked = isOver && nearAvg;

    let status: ProcessingStatus = "pending_review";
    if (avgMasked) {
      status = "overridden_by_average";
    }

    return {
      ...record,
      isOverThreshold: isOver,
      thresholdValue: recConfig.upperLimit,
      thresholdUnit: recConfig.unit,
      avgMasked,
      processingStatus: status,
    };
  });
}

function computeAverage(records: TensionRecord[]): number {
  if (records.length === 0) return 0;
  const sum = records.reduce((acc, r) => acc + r.tensionValue, 0);
  return sum / records.length;
}

export function recalculateAfterSupplement(
  existingRecords: TensionRecord[],
  supplementRecords: TensionRecord[],
  config: ThresholdConfig,
  beltThresholds?: BeltThreshold[]
): TensionRecord[] {
  const merged = [...existingRecords, ...supplementRecords];
  const avg = computeAverage(merged);
  const thresholds = beltThresholds ?? [];

  return merged.map((record) => {
    const recConfig = getThresholdForRecord(record, thresholds, config);
    const isOver = checkThreshold(record.tensionValue, recConfig);
    const nearAvg = Math.abs(record.tensionValue - avg) < avg * 0.05;
    const avgMasked = isOver && nearAvg;

    const prevMasked = record.avgMasked;
    const statusChanged = prevMasked !== avgMasked;

    let status: ProcessingStatus = record.processingStatus;
    if (isOver && avgMasked) {
      status = "overridden_by_average";
    } else if (isOver && !avgMasked) {
      status = statusChanged ? "pending_review" : record.processingStatus;
    }

    return {
      ...record,
      isOverThreshold: isOver,
      thresholdValue: recConfig.upperLimit,
      thresholdUnit: recConfig.unit,
      avgMasked,
      processingStatus: status,
    };
  });
}

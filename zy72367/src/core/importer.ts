import type {
  TensionRecord,
  ImportResult,
  ImportStep,
  DedupCategory,
  CurrentBatchDuplicateKey,
  HistoryDuplicateKey,
} from "../types.js";
import {
  processRecords,
  recalculateAfterSupplement,
  type ThresholdConfig,
} from "./processor.js";

let existingRecords: TensionRecord[] = [];
let batchCounter = 0;

export function resetImporter(): void {
  existingRecords = [];
  batchCounter = 0;
}

export function firstImport(
  rawData: Array<{
    originalLineNumber: number;
    timestamp: string;
    beltId: string;
    tensionValue: number;
    unit: string;
    temperature: number | null;
  }>,
  config: ThresholdConfig
): ImportResult {
  const batchId = `batch_${++batchCounter}`;

  const seenInBatch = new Map<string, { line: number; firstId: string }>();
  const newRecordIds: string[] = [];
  const currentBatchDuplicateKeys: CurrentBatchDuplicateKey[] = [];
  const historyDuplicateKeys: HistoryDuplicateKey[] = [];

  const historyKeyMap = new Map<string, string>();
  for (const rec of existingRecords) {
    const key = `${rec.beltId}_${rec.timestamp}_${rec.tensionValue}`;
    historyKeyMap.set(key, rec.id);
  }

  const records: TensionRecord[] = [];
  let duplicateSkipped = 0;

  for (const raw of rawData) {
    const key = `${raw.beltId}_${raw.timestamp}_${raw.tensionValue}`;
    let dedupCategory: DedupCategory;
    let skipRecord = false;

    const historyExistingId = historyKeyMap.get(key);
    if (historyExistingId) {
      dedupCategory = "dup_history";
      historyDuplicateKeys.push({ key, line: raw.originalLineNumber, existingId: historyExistingId });
      duplicateSkipped++;
      skipRecord = true;
    } else if (seenInBatch.has(key)) {
      dedupCategory = "dup_in_batch";
      const firstOccurrence = seenInBatch.get(key)!;
      currentBatchDuplicateKeys.push({ key, line: raw.originalLineNumber });
      duplicateSkipped++;
      skipRecord = true;
    } else {
      dedupCategory = "new";
      const recordId = `${batchId}_${raw.originalLineNumber}`;
      seenInBatch.set(key, { line: raw.originalLineNumber, firstId: recordId });

      const record: TensionRecord = {
        id: recordId,
        originalLineNumber: raw.originalLineNumber,
        timestamp: raw.timestamp,
        beltId: raw.beltId,
        tensionValue: raw.tensionValue,
        unit: raw.unit,
        temperature: raw.temperature,
        temperatureCalibrationNote: null,
        samplingIntervalNote: null,
        isOverThreshold: false,
        thresholdValue: config.upperLimit,
        processingStatus: "pending_review",
        avgMasked: false,
        manualOverrides: [],
        importBatchId: batchId,
        importStep: "first_import",
        dedupCategory,
      };
      records.push(record);
      newRecordIds.push(recordId);
    }
  }

  const processed = processRecords(records, config);
  existingRecords = processed;

  return {
    batchId,
    step: "first_import",
    importedCount: processed.length,
    duplicateSkipped,
    overThresholdCount: processed.filter((r) => r.isOverThreshold).length,
    avgMaskedCount: processed.filter((r) => r.avgMasked).length,
    records: processed,
    newRecordIds,
    currentBatchDuplicateKeys,
    historyDuplicateKeys,
  };
}

export function supplementTemperatureCalibration(
  supplements: Array<{
    beltId: string;
    timestamp: string;
    calibrationNote: string;
    temperature: number;
  }>,
  config: ThresholdConfig
): ImportResult {
  const batchId = `batch_${++batchCounter}`;
  let matched = 0;

  for (const sup of supplements) {
    const record = existingRecords.find(
      (r) => r.beltId === sup.beltId && r.timestamp === sup.timestamp
    );
    if (record) {
      record.temperatureCalibrationNote = sup.calibrationNote;
      record.temperature = sup.temperature;
      matched++;
    }
  }

  const recalculated = recalculateAfterSupplement(existingRecords, [], config);
  existingRecords = recalculated;

  return {
    batchId,
    step: "temperature_calibration_review",
    importedCount: matched,
    duplicateSkipped: 0,
    overThresholdCount: recalculated.filter((r) => r.isOverThreshold).length,
    avgMaskedCount: recalculated.filter((r) => r.avgMasked).length,
    records: recalculated,
    newRecordIds: [],
    currentBatchDuplicateKeys: [],
    historyDuplicateKeys: [],
  };
}

export function updateUnitConversion(
  conversionMap: Array<{
    beltId: string;
    fromUnit: string;
    toUnit: string;
    factor: number;
  }>,
  config: ThresholdConfig
): ImportResult {
  const batchId = `batch_${++batchCounter}`;

  const updated = existingRecords.map((record) => {
    const conv = conversionMap.find(
      (c) => c.beltId === record.beltId && c.fromUnit === record.unit
    );
    if (!conv) return record;

    const newValue = record.tensionValue * conv.factor;
    const override = {
      operator: "unit_conversion",
      previousValue: record.tensionValue,
      newValue,
      reason: `${conv.fromUnit} -> ${conv.toUnit}, factor ${conv.factor}`,
      timestamp: new Date().toISOString(),
    };

    return {
      ...record,
      tensionValue: newValue,
      unit: conv.toUnit,
      manualOverrides: [...record.manualOverrides, override],
    };
  });

  const recalculated = processRecords(updated, config);
  existingRecords = recalculated;

  return {
    batchId,
    step: "unit_conversion_update",
    importedCount: updated.length,
    duplicateSkipped: 0,
    overThresholdCount: recalculated.filter((r) => r.isOverThreshold).length,
    avgMaskedCount: recalculated.filter((r) => r.avgMasked).length,
    records: recalculated,
    newRecordIds: [],
    currentBatchDuplicateKeys: [],
    historyDuplicateKeys: [],
  };
}

export function getExistingRecords(): TensionRecord[] {
  return [...existingRecords];
}

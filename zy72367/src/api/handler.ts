import type { InspectionResult, TensionRecord, InspectionSummary } from "../types.js";
import { getResult, getRecords, getSummary } from "../core/result-store.js";

export function apiGetRecords(): TensionRecord[] {
  return getRecords();
}

export function apiGetSummary(): InspectionSummary {
  return getSummary();
}

export function apiGetResult(): InspectionResult {
  return getResult();
}

export function apiGetExportData(): object {
  const result = getResult();
  return {
    generatedAt: result.generatedAt,
    summary: result.summary,
    records: result.records.map((r) => ({
      originalLineNumber: r.originalLineNumber,
      timestamp: r.timestamp,
      beltId: r.beltId,
      tensionValue: r.tensionValue,
      unit: r.unit,
      temperature: r.temperature,
      temperatureCalibrationNote: r.temperatureCalibrationNote ?? "",
      isOverThreshold: r.isOverThreshold,
      thresholdValue: r.thresholdValue,
      processingStatus: r.processingStatus,
      avgMasked: r.avgMasked,
      samplingIntervalNote: r.samplingIntervalNote
        ? {
            originalLineNumber: r.samplingIntervalNote.originalLineNumber,
            note: r.samplingIntervalNote.note,
            manualChange: r.samplingIntervalNote.manualChange ?? "",
            currentStatus: r.samplingIntervalNote.currentStatus,
            updatedAt: r.samplingIntervalNote.updatedAt,
          }
        : null,
      manualOverrides: r.manualOverrides.map((o) => ({
        operator: o.operator,
        previousValue: o.previousValue,
        newValue: o.newValue,
        reason: o.reason,
        timestamp: o.timestamp,
      })),
      importBatchId: r.importBatchId,
      importStep: r.importStep,
    })),
  };
}

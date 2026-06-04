import type { TensionRecord, InspectionResult, InspectionSummary } from "../types.js";

let records: TensionRecord[] = [];
let lastGeneratedAt: string = "";

export function setRecords(newRecords: TensionRecord[]): void {
  records = newRecords;
  lastGeneratedAt = new Date().toISOString();
}

export function getRecords(): TensionRecord[] {
  return [...records];
}

export function getResult(): InspectionResult {
  const summary = buildSummary(records);
  return {
    records: [...records],
    summary,
    generatedAt: lastGeneratedAt,
  };
}

export function getSummary(): InspectionSummary {
  return buildSummary(records);
}

function buildSummary(recs: TensionRecord[]): InspectionSummary {
  return {
    totalRecords: recs.length,
    overThresholdCount: recs.filter((r) => r.isOverThreshold).length,
    avgMaskedButOverThresholdCount: recs.filter(
      (r) => r.avgMasked && r.isOverThreshold
    ).length,
    pendingReviewCount: recs.filter((r) => r.processingStatus === "pending_review")
      .length,
    confirmedNormalCount: recs.filter(
      (r) => r.processingStatus === "confirmed_normal"
    ).length,
    confirmedAbnormalCount: recs.filter(
      (r) => r.processingStatus === "confirmed_abnormal"
    ).length,
  };
}

export function resetStore(): void {
  records = [];
  lastGeneratedAt = "";
}

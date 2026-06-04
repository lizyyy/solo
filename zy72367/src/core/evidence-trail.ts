import type { TensionRecord, ProcessingStatus, SamplingIntervalNote } from "../types.js";

export function attachSamplingNote(
  record: TensionRecord,
  note: string,
  manualChange: string | null
): TensionRecord {
  const updated: SamplingIntervalNote = {
    originalLineNumber: record.originalLineNumber,
    note,
    manualChange,
    currentStatus: record.processingStatus,
    updatedAt: new Date().toISOString(),
  };
  return { ...record, samplingIntervalNote: updated };
}

export function updateProcessingStatus(
  record: TensionRecord,
  newStatus: ProcessingStatus,
  reason: string
): TensionRecord {
  const prevStatus = record.processingStatus;
  const updatedNote = record.samplingIntervalNote
    ? {
        ...record.samplingIntervalNote,
        currentStatus: newStatus,
        manualChange: `status ${prevStatus} -> ${newStatus}, reason: ${reason}`,
        updatedAt: new Date().toISOString(),
      }
    : null;

  return {
    ...record,
    processingStatus: newStatus,
    samplingIntervalNote: updatedNote,
  };
}

export function getEvidenceSummary(record: TensionRecord): string {
  const parts: string[] = [];
  parts.push(`line ${record.originalLineNumber}, belt ${record.beltId}`);
  parts.push(`tension ${record.tensionValue}${record.unit}, threshold ${record.thresholdValue}${record.unit}`);
  if (record.isOverThreshold) {
    parts.push("over threshold");
  }
  if (record.avgMasked) {
    parts.push("masked by average but over-threshold fact preserved");
  }
  parts.push(`status: ${statusLabel(record.processingStatus)}`);
  if (record.samplingIntervalNote) {
    parts.push(`sampling note: ${record.samplingIntervalNote.note}`);
    if (record.samplingIntervalNote.manualChange) {
      parts.push(`manual change: ${record.samplingIntervalNote.manualChange}`);
    }
  }
  return parts.join("; ");
}

function statusLabel(s: ProcessingStatus): string {
  const map: Record<ProcessingStatus, string> = {
    pending_review: "pending review",
    confirmed_normal: "confirmed normal",
    confirmed_abnormal: "confirmed abnormal",
    overridden_by_average: "overridden by average",
  };
  return map[s];
}

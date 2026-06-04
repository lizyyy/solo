import type { TensionRecord, ProcessingStatus } from "../types.js";
export declare function attachSamplingNote(record: TensionRecord, note: string, manualChange: string | null): TensionRecord;
export declare function updateProcessingStatus(record: TensionRecord, newStatus: ProcessingStatus, reason: string): TensionRecord;
export declare function getEvidenceSummary(record: TensionRecord): string;

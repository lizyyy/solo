export type RecordStatus = "pending" | "confirmed" | "withdrawn";

export type AnomalyType = "gap" | "missing" | "conflict";

export interface GapDetail {
  prevRowId: string;
  prevValue: string | null;
  currValue: string | null;
}

export interface SpareRecord {
  id: string;
  partNo: string;
  partDesc: string;
  rawRow: string;
  rawRowHistory: string[];
  sourceFile: string;
  sourceBatch: string;
  status: RecordStatus;
  remark: string;
  sampling: string | null;
  mappedFields: Record<string, string>;
  anomalies: AnomalyType[];
  gapDetail?: GapDetail;
  createdAt: number;
  updatedAt: number;
}

export interface ImportBatch {
  batchId: string;
  fileName: string;
  rowCount: number;
  createdCount: number;
  mergedCount: number;
  skippedCount: number;
  importedAt: number;
}

export interface SchemaMap {
  fileSignature: string;
  mapping: Record<string, string>;
  usedCount: number;
}

export interface MergeResult {
  records: SpareRecord[];
  createdCount: number;
  mergedCount: number;
  skippedCount: number;
}

export const STORAGE_KEYS = {
  records: "pump-station::records",
  batches: "pump-station::batches",
  schemas: "pump-station::schemas",
  version: "pump-station::version",
} as const;

export const CURRENT_VERSION = "1.0.0";

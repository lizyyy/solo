export interface Batch {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived";
}

export interface ImportJob {
  id: string;
  batchId: string;
  sourceType: "gis" | "street_table" | "photo" | "approval";
  fileName: string;
  importTime: string;
  status: "pending" | "previewing" | "confirmed" | "merged" | "failed";
  recordCount: number;
  fieldMapping: Record<string, string>;
  rawPreview: Record<string, unknown>[];
}

export interface MergedPoint {
  id: string;
  batchId: string;
  gisId: string;
  address: string;
  businessType: string;
  area: number;
  sourceCount: number;
  conflictStatus: "none" | "conflict" | "resolved";
  originalNotes: string;
  appendedNotes: AppendedNote[];
  sources: EvidenceRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ConflictItem {
  id: string;
  mergedPointId: string;
  fieldName: string;
  gisValue: string;
  importedValue: string;
  gisSource: EvidenceRecord;
  importSource: EvidenceRecord;
  suggestion: "use_gis" | "use_import" | "manual";
  resolution: "use_gis" | "use_import" | "manual" | "pending_verification" | null;
  resolutionReason: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface Anomaly {
  id: string;
  mergedPointId: string;
  batchId: string;
  type: "capacity_overlimit" | "time_period_conflict";
  description: string;
  humanReadable: string;
  detectedAt: string;
}

export interface EvidenceRecord {
  id: string;
  mergedPointId: string;
  sourceType: "gis" | "street_table" | "photo" | "approval";
  fileName: string;
  importTime: string;
  processTime: string;
  originalValue: string;
}

export interface AppendedNote {
  id: string;
  mergedPointId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  batchId: string;
  action: "import" | "merge" | "resolve" | "export" | "note_append";
  actor: string;
  timestamp: string;
  detail: string;
  relatedId: string;
}

export interface BatchSummary {
  batch: Batch;
  importCount: number;
  mergedPointCount: number;
  conflictCount: number;
  unresolvedConflictCount: number;
  anomalyCount: number;
}

export interface ExportRequest {
  batchId: string;
  filters: {
    district?: string;
    businessType?: string;
    updateStatus?: string;
    conflictStatus?: string;
  };
  format: "excel" | "pdf";
}

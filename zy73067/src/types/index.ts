export interface AlertFactor {
  name: string;
  value: number;
  threshold: number;
  deviationPct: number;
  isPulling: boolean;
}

export interface ConclusionFile {
  name: string;
  uploadedAt: string;
  conclusion: "pass" | "fail" | "pending";
}

export type AlertStatus = "pending" | "reviewing" | "approved" | "rejected";

export interface AlertRecord {
  id: string;
  unifiedDeviceId: string;
  originalDeviceIds: string[];
  source: string;
  bladeAngle: number;
  bladeAngleThreshold: number;
  vibrationLevel: number;
  vibrationThreshold: number;
  isTempThresholdAdjusted: boolean;
  tempAdjustReason?: string;
  tempAdjustApprover?: string;
  tempAdjustTime?: string;
  status: AlertStatus;
  remark: string;
  conclusionFile?: ConclusionFile;
  factors: AlertFactor[];
  sparePartsFields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface FieldMapping {
  id: string;
  spareFieldName: string;
  systemFieldName: string;
  source: string;
  isProtected: boolean;
}

export interface DeviceIdMapping {
  unifiedId: string;
  patterns: string[];
}

export interface PageSnapshot {
  routePath: string;
  scrollPosition: number;
  filters: Record<string, any>;
  selectedRecordId?: string;
  expandedRowIds: string[];
  timestamp: string;
}

export type StatusFilter = "all" | AlertStatus;

export interface FilterState {
  searchQuery: string;
  status: StatusFilter;
  showTempAdjustedOnly: boolean;
  source: string;
}

export interface SummaryStats {
  pending: number;
  approved: number;
  rejected: number;
  reviewing: number;
  tempAdjusted: number;
  total: number;
}

export interface ConsistencyMismatch {
  field: string;
  statusValue: string;
  remarkValue: string;
  fileValue: string;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  mismatches: ConsistencyMismatch[];
}

export interface ExportRow {
  unifiedDeviceId: string;
  originalIds: string;
  source: string;
  status: string;
  statusText: string;
  remark: string;
  fileConclusion: string;
  isTempAdjusted: boolean;
  bladeAngle: number;
  bladeThreshold: number;
  vibration: number;
  vibrationThreshold: number;
  isConsistent: boolean;
  verifiedAt: string;
}

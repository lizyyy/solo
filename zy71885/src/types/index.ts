export type UserRole = "assistant" | "teacher";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type RecordStatus = "pending" | "reviewed" | "rejected";

export type RecordSource = "sensor" | "manual";

export interface CalibrationEntry {
  id: string;
  label: string;
  theoreticalValue: number;
  measuredValue: number;
  error: number;
  createdAt: string;
  updatedAt: string;
}

export interface Record {
  id: string;
  source: RecordSource;
  status: RecordStatus;
  pendingReason: string;
  sensorLogId?: string;
  experimentName: string;
  studentId?: string;
  studentName?: string;
  focalLength: number;
  measuredFocalLength: number;
  objectDistance: number;
  imageDistance: number;
  zeroDrift: number;
  error: number;
  operatorId: string;
  reviewerId?: string;
  rejectReason?: string;
  calibrationTable: CalibrationEntry[];
  createdAt: string;
  updatedAt: string;
}

export type HistoryAction =
  | "create"
  | "review_approve"
  | "review_reject"
  | "calibration_correct"
  | "edit";

export interface HistoryEntry {
  id: string;
  recordId: string;
  operatorId: string;
  action: HistoryAction;
  reason: string;
  before: Record;
  after: Record;
  changedFields: string[];
  createdAt: string;
}

export interface ConsistencyIssue {
  recordId: string;
  recordName: string;
  severity: "error" | "warning";
  message: string;
  field?: string;
}

export type ExportFormat = "csv" | "json";

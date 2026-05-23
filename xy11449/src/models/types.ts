export enum DataSource {
  PILE_ALARM = 'pile_alarm',
  INSPECTION_FORM = 'inspection_form',
  CUSTOMER_COMPLAINT = 'customer_complaint',
  MANUAL_SUPPLEMENT = 'manual_supplement',
  SHIFT_RECORD = 'shift_record'
}

export enum RecordStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REJECTED = 'rejected',
  SECONDARY_CONFIRMED = 'secondary_confirmed',
  FROZEN = 'frozen',
  ARCHIVED = 'archived'
}

export enum FaultStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  FALSE_ALARM = 'false_alarm',
  REASSIGNED = 'reassigned'
}

export enum Role {
  OPERATOR = 'operator',
  TEAM_LEADER = 'team_leader',
  AREA_MANAGER = 'area_manager',
  AUDITOR = 'auditor',
  ADMIN = 'admin'
}

export interface SourceEvidence {
  id: string;
  sourceType: DataSource;
  sourceFile: string;
  sourceRow: number;
  rawData: Record<string, any>;
  parsedData: Record<string, any>;
  importedAt: string;
  importedBy: string;
  checksum: string;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: string;
  changeReason: string;
  isManualOverride: boolean;
}

export interface AuditLog {
  id: string;
  recordId: string;
  action: string;
  operator: string;
  role: Role;
  timestamp: string;
  details: Record<string, any>;
  ip?: string;
}

export interface PileAlarmData {
  pileId: string;
  alarmCode: string;
  alarmLevel: 'info' | 'warning' | 'error' | 'critical';
  alarmTime: string;
  recoverTime?: string;
  alarmDescription: string;
  faultDuration?: number;
}

export interface InspectionData {
  inspectionId: string;
  pileId: string;
  inspector: string;
  inspectionTime: string;
  inspectionItems: string[];
  foundIssues: string[];
  status: 'normal' | 'needs_repair' | 'critical';
}

export interface ComplaintData {
  complaintId: string;
  pileId: string;
  customerId: string;
  complaintType: string;
  complaintTime: string;
  description: string;
  handler?: string;
}

export interface LedgerRecord {
  id: string;
  factKey: string;
  pileId: string;
  status: RecordStatus;
  faultStatus: FaultStatus;
  faultStartTime: string;
  faultEndTime?: string;
  faultDuration: number;
  faultType: string;
  faultDescription: string;
  handler?: string;
  handlerRole?: Role;
  processor?: string;
  area?: string;
  evidences: string[];
  changeLogs: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  frozenAt?: string;
  isManuallyModified: boolean;
  modificationReason?: string;
  sensitiveFields: string[];
  version: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  total: number;
  errors: ImportError[];
  recordIds: string[];
}

export interface ImportError {
  row: number;
  sourceFile: string;
  error: string;
  rawData: Record<string, any>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'excel';
  anonymize: boolean;
  includeEvidence: boolean;
  includeChangeLogs: boolean;
  dateRange?: { start: string; end: string };
  area?: string;
}

export interface ViewFilter {
  role?: Role;
  area?: string;
  status?: RecordStatus;
  faultStatus?: FaultStatus;
  dateRange?: { start: string; end: string };
  pileId?: string;
}

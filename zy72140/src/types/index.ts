export interface Schedule {
  id: string;
  volunteerName: string;
  role: string;
  timeSlot: string;
  date: string;
  status: 'confirmed' | 'pending' | 'conflict' | 'cancelled';
  remark: string;
  remarkHistory: RemarkChange[];
  createdAt: string;
  updatedAt: string;
}

export interface RemarkChange {
  from: string;
  to: string;
  changedAt: string;
}

export interface Material {
  id: string;
  scheduleId: string;
  type: 'tracklist' | 'audio' | 'contract_scan' | 'group_annotation';
  name: string;
  description: string;
  fileUrl: string;
  annotation: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  scheduleId: string;
  action: 'remark_edit' | 'import_success' | 'import_fail' | 'conflict_detected' | 'conflict_resolved' | 'material_linked';
  beforeValue: string;
  afterValue: string;
  evidence: string;
  suggestion: string;
  createdAt: string;
}

export interface ConflictRecord {
  id: string;
  scheduleId: string;
  field: string;
  importValue: string;
  contractValue: string;
  contractEvidence: string;
  resolution: 'keep_import' | 'keep_contract' | 'manual_merge' | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
  importedScheduleData: Partial<Schedule> | null;
  isNewSchedule: boolean;
}

export interface ImportResult {
  total: number;
  succeeded: number;
  failed: ImportFailure[];
  conflicts: ConflictRecord[];
}

export interface ImportFailure {
  rowIndex: number;
  rawData: string;
  errorType: 'format_error' | 'missing_field' | 'duplicate' | 'invalid_value';
  errorMessage: string;
  suggestion: string;
}

export enum BedStatus {
  OCCUPIED = 'occupied',
  VACANT = 'vacant',
  CLEANING = 'cleaning',
  LOCKED = 'locked',
  TRANSFER = 'transfer'
}

export enum PatientStatus {
  ADMITTED = 'admitted',
  TRANSFERRED = 'transferred',
  DISCHARGED = 'discharged'
}

export enum CleaningStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}

export enum DiscrepancyType {
  STATUS_MISMATCH = 'status_mismatch',
  DUPLICATE_OCCUPANCY = 'duplicate_occupancy',
  TRANSFER_LOCK_BED = 'transfer_lock_bed',
  CLEANING_TIMEOUT = 'cleaning_timeout',
  MISSING_PATIENT = 'missing_patient',
  EXTRA_PATIENT = 'extra_patient',
  BED_NOT_CLEANED = 'bed_not_cleaned',
  DATA_INCONSISTENCY = 'data_inconsistency'
}

export enum ReviewResult {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_MORE_INFO = 'needs_more_info',
  MANUALLY_RESOLVED = 'manually_resolved'
}

export enum ReviewAction {
  RELEASE = 'release',
  LOCK = 'lock',
  UPDATE_STATUS = 'update_status',
  ASSIGN_PATIENT = 'assign_patient',
  REMOVE_PATIENT = 'remove_patient',
  MARK_CLEANED = 'mark_cleaned',
  FLAG_FOR_FOLLOWUP = 'flag_for_followup'
}

export enum PatientOutcome {
  RECOVERY_DISCHARGE = 'recovery_discharge',
  TRANSFER_TO_OTHER_WARD = 'transfer_to_other_ward',
  TRANSFER_TO_ICU = 'transfer_to_icu',
  DEATH = 'death',
  AUTOPSY = 'autopsy',
  OTHER = 'other'
}

export enum DataSource {
  BED_CSV = 'bed_csv',
  PATIENT_JSON = 'patient_json',
  CLEANING_WORKORDER = 'cleaning_workorder',
  MANUAL_REVIEW = 'manual_review'
}

export interface Bed {
  id: string;
  bedNumber: string;
  ward: string;
  room: string;
  status: BedStatus;
  currentPatientId?: string;
  isLocked: boolean;
  lockReason?: string;
  lockedBy?: string;
  lockedAt?: Date;
  lastCleanedAt?: Date;
  cleaningStatus?: CleaningStatus;
  assignedNurse?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  source: DataSource;
}

export interface Patient {
  id: string;
  medicalRecordNumber: string;
  name: string;
  age: number;
  gender: string;
  diagnosis: string;
  status: PatientStatus;
  currentBedId?: string;
  admissionDate: Date;
  expectedDischargeDate?: Date;
  actualDischargeDate?: Date;
  outcome?: PatientOutcome;
  outcomeNotes?: string;
  transferFromWard?: string;
  transferToWard?: string;
  transferDate?: Date;
  attendingPhysician: string;
  responsibleNurse?: string;
  history: PatientHistoryRecord[];
  createdAt: Date;
  updatedAt: Date;
  source: DataSource;
}

export interface PatientHistoryRecord {
  id: string;
  timestamp: Date;
  action: string;
  previousStatus?: PatientStatus;
  newStatus?: PatientStatus;
  previousBedId?: string;
  newBedId?: string;
  previousWard?: string;
  newWard?: string;
  outcome?: PatientOutcome;
  performedBy: string;
  notes?: string;
  source: DataSource;
}

export interface CleaningWorkOrder {
  id: string;
  bedId: string;
  bedNumber: string;
  ward: string;
  patientId?: string;
  patientName?: string;
  requestedBy: string;
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: CleaningStatus;
  assignedTo?: string;
  priority: 'normal' | 'urgent';
  notes?: string;
  cleaningDurationMinutes?: number;
  qualityCheckPassed?: boolean;
  checkedBy?: string;
  checkedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  source: DataSource;
}

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  bedId?: string;
  bedNumber?: string;
  patientId?: string;
  patientName?: string;
  workOrderId?: string;
  description: string;
  detailedExplanation: string;
  sourceData: {
    bedStatus?: BedStatus;
    patientStatus?: PatientStatus;
    cleaningStatus?: CleaningStatus;
  };
  affectedFields: string[];
  dataSources: DataSource[];
  detectedAt: Date;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  reviewStatus?: ReviewResult;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  entityType: 'bed' | 'patient' | 'workorder' | 'discrepancy' | 'reconciliation';
  entityId: string;
  previousValue?: any;
  newValue?: any;
  performedBy: string;
  notes?: string;
  ipAddress?: string;
  source: DataSource;
}

export interface ReconciliationRecord {
  id: string;
  batchId: string;
  reconciliationDate: Date;
  ward?: string;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  cleaningBeds: number;
  lockedBeds: number;
  totalPatients: number;
  admittedPatients: number;
  dischargedPatients: number;
  transferredPatients: number;
  totalWorkOrders: number;
  pendingCleaning: number;
  inProgressCleaning: number;
  completedCleaning: number;
  overdueCleaning: number;
  discrepanciesFound: number;
  discrepanciesResolved: number;
  discrepanciesPending: number;
  performedBy: string;
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  notes?: string;
}

export interface ReviewDecision {
  id: string;
  discrepancyId: string;
  result: ReviewResult;
  action: ReviewAction;
  decisionNotes: string;
  supportingEvidence?: string[];
  requiresFollowUp: boolean;
  followUpDeadline?: Date;
  assignedTo?: string;
  madeBy: string;
  madeAt: Date;
}

export interface ReconciliationReport {
  summary: ReconciliationRecord;
  discrepancies: Discrepancy[];
  beds: Bed[];
  patients: Patient[];
  workOrders: CleaningWorkOrder[];
  reviewDecisions: ReviewDecision[];
  auditTrail: AuditLog[];
  generatedAt: Date;
  generatedBy: string;
}

export interface ImportResult<T> {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  failedRecords: number;
  errors: string[];
  warnings: string[];
  data: T[];
}

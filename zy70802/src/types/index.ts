export type CriticalValuePriority = 'normal' | 'urgent' | 'emergency';
export type ReconciliationStatus = 'matched' | 'mismatched' | 'pending' | 'reviewed';
export type DiscrepancyType = 
  | 'no_callback' 
  | 'callback_timeout' 
  | 'multiple_critical_values' 
  | 'shift_gap' 
  | 'doctor_confirmation_missing'
  | 'data_inconsistency';

export interface CriticalValueRecord {
  id: string;
  patientId: string;
  patientName: string;
  department: string;
  ward: string;
  bedNo: string;
  testItem: string;
  testResult: string;
  referenceRange: string;
  priority: CriticalValuePriority;
  reportedAt: Date;
  reportedBy: string;
  smsSentAt?: Date;
  notes?: string;
}

export interface CallbackRecord {
  id: string;
  criticalValueId?: string;
  patientId: string;
  patientName: string;
  calledAt: Date;
  calledBy: string;
  calledTo: string;
  doctorName: string;
  confirmedAt?: Date;
  confirmationNotes?: string;
  callResult: 'connected' | 'no_answer' | 'busy' | 'wrong_number';
}

export interface DutySchedule {
  id: string;
  date: Date;
  shift: 'morning' | 'afternoon' | 'night';
  department: string;
  doctorName: string;
  doctorPhone: string;
  startTime: Date;
  endTime: Date;
}

export interface Discrepancy {
  type: DiscrepancyType;
  description: string;
  severity: 'high' | 'medium' | 'low';
  details: Record<string, any>;
}

export interface ReconciliationResult {
  id: string;
  criticalValueId: string;
  callbackId?: string;
  status: ReconciliationStatus;
  discrepancies: Discrepancy[];
  matchedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface ReconciliationSummary {
  totalCriticalValues: number;
  totalCallbacks: number;
  matchedCount: number;
  mismatchedCount: number;
  pendingCount: number;
  reviewedCount: number;
  discrepancyBreakdown: Record<DiscrepancyType, number>;
  departmentStats: Record<string, {
    total: number;
    matched: number;
    mismatched: number;
  }>;
}

export interface ReviewAction {
  id: string;
  reconciliationId: string;
  actionType: 'confirm' | 'modify' | 'dismiss';
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
}

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  totalCount: number;
  importedCount: number;
}

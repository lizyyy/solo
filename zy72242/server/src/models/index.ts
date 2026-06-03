export type RecordStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';
export type ModificationType = 't1_to_t2' | 'other';
export type OperatorRole = 'fund_manager' | 'product_manager' | 'system';
export type AuditAction = 'create' | 'modify' | 'import' | 'adjust' | 'review' | 'rerun';
export type HolidayType = 'weekend' | 'public_holiday';

export interface ReconciliationRecord {
  id: string;
  tradeDate: string;
  expectedArrivalDate: string;
  actualArrivalDate: string;
  amount: number;
  fundCode: string;
  futuresCode: string;
  status: RecordStatus;
  hasManualModification: boolean;
  modificationType?: ModificationType;
  modifiedBy?: string;
  modifiedAt?: string;
  modificationReason?: string;
  whyKept: string;
  missingMaterials: string;
  nextAction: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationRecordWithRelations extends ReconciliationRecord {
  adjustments: TailAdjustment[];
  auditLogs: AuditLog[];
  reviews: ReviewRecord[];
}

export interface TailAdjustment {
  id: string;
  recordId: string;
  amount: number;
  reason: string;
  adjustedBy: string;
  adjustedAt: string;
  affectsReconciliation: boolean;
}

export interface AuditLog {
  id: string;
  recordId: string;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason: string;
  operator: string;
  operatorRole: OperatorRole;
  timestamp: string;
  affectedResults: string;
}

export interface ReviewRecord {
  id: string;
  recordId: string;
  reviewer: string;
  status: 'approved' | 'rejected';
  comment?: string;
  reviewedAt: string;
}

export interface Holiday {
  date: string;
  name: string;
  type: HolidayType;
}

export interface ReconciliationNoteUpdate {
  whyKept: string;
  missingMaterials: string;
  nextAction: string;
  updatedBy: string;
}

export interface TailAdjustmentCreate {
  recordId: string;
  amount: number;
  reason: string;
  adjustedBy: string;
}

export interface ReviewCreate {
  recordId: string;
  reviewer: string;
  status: 'approved' | 'rejected';
  comment?: string;
}

export interface ImportRecord {
  tradeDate: string;
  expectedArrivalDate: string;
  actualArrivalDate: string;
  amount: number;
  fundCode: string;
  futuresCode: string;
}

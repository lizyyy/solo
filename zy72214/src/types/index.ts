export enum ProcessingStatus {
  IMPORTED = 'IMPORTED',
  PENDING_APPROVER_VERIFICATION = 'PENDING_APPROVER_VERIFICATION',
  APPROVER_VERIFIED = 'APPROVER_VERIFIED',
  EX_RIGHTS_DATE_REVIEWED = 'EX_RIGHTS_DATE_REVIEWED',
  BALANCE_UPDATED = 'BALANCE_UPDATED',
  NEEDS_REWORK = 'NEEDS_REWORK',
  ROLLBACKED = 'ROLLBACKED'
}

export enum ChangeType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ROLLBACK = 'ROLLBACK',
  STATUS_CHANGE = 'STATUS_CHANGE'
}

export interface CustodianConfirmationRaw {
  originalRowNumber: number;
  importBatchId: string;
  clientAccount: string;
  interestAmount: number;
  approverName: string;
  approvalDate: string;
  rawContent: string;
}

export interface ManualModification {
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedAt: string;
  reason: string;
}

export interface CustodianConfirmation {
  id: string;
  originalRowNumber: number;
  importBatchId: string;
  importedAt: string;
  importedBy: string;
  clientAccount: string;
  interestAmount: number;
  approverName: string;
  approvalDate: string;
  rawContent: string;
  remark: string;
  status: ProcessingStatus;
  manualModifications: ManualModification[];
  isPinyinApprover: boolean;
  currentAssignee: string | null;
  balanceUpdateId: string | null;
  exRightsDateReviewId: string | null;
}

export interface ExRightsDateReview {
  id: string;
  confirmationId: string;
  reviewedBy: string;
  reviewedAt: string;
  screenshotReference: string;
  hasExRightsEvent: boolean;
  exRightsDate: string | null;
  impactDescription: string;
  adjustmentAmount: number;
}

export interface BalanceChange {
  id: string;
  confirmationId: string;
  updatedAt: string;
  updatedBy: string;
  previousBalance: number;
  newBalance: number;
  interestAmount: number;
  adjustmentAmount: number;
  effectiveDate: string;
}

export interface HistoryRecord {
  id: string;
  entityId: string;
  entityType: 'CONFIRMATION' | 'BALANCE_CHANGE' | 'EX_RIGHTS_REVIEW';
  changeType: ChangeType;
  changedBy: string;
  changedAt: string;
  beforeState: any;
  afterState: any;
  diffSummary: string;
}

export interface ImportResult {
  successCount: number;
  duplicateCount: number;
  pinyinApproverCount: number;
  importedIds: string[];
  duplicateRowNumbers: number[];
}

export interface RollbackResult {
  success: boolean;
  rollbackedStatus: ProcessingStatus;
  message: string;
}

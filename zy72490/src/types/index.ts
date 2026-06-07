export type SamplingPointType = 'day' | 'night';

export interface SamplingPoint {
  id: string;
  name: string;
  location: string;
  type: SamplingPointType;
  importTime: string;
}

export interface ComplaintRecord {
  complaintNo: string;
  pointId: string;
  content: string;
  summaryOnly: boolean;
  receivedTime: string;
  oldCaliber?: boolean;
}

export type ScheduleStatus = 'normal' | 'pending_review' | 'supplemented' | 'conflict' | 'reviewed';

export type OperationType = 'create' | 'import' | 'update' | 'correct' | 'rerun' | 'review' | 'supplement';

export interface ScheduleRecord {
  id: string;
  pointId: string;
  pointName: string;
  complaintNo?: string;
  status: ScheduleStatus;
  supplyTime: string;
  remarks: string;
  hasManualCorrection: boolean;
  hasRerun: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryVersion {
  id: string;
  recordId: string;
  version: number;
  snapshot: ScheduleRecord;
  operationType: OperationType;
  operator: string;
  description: string;
  timestamp: string;
}

export type ConflictType = 'wrong_caliber' | 'supplement' | 'pending_review';

export interface ConflictItem {
  id: string;
  recordId: string;
  type: ConflictType;
  description: string;
  resolved: boolean;
  resolver?: string;
  resolvedAt?: string;
}

export interface WizardState {
  currentStep: number;
  imported: boolean;
  complaintsMatched: boolean;
  reviewTableUpdated: boolean;
}

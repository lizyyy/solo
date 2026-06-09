export type Specialty = 'HVAC' | 'ELECTRICAL' | 'PLUMBING' | 'FIRE';

export type MaterialStatus =
  | 'PENDING'
  | 'PROCESSED'
  | 'SUSPENDED'
  | 'MISSING'
  | 'AWAITING_PM';

export type JudgeResult = 'PASS' | 'FAIL' | 'CONDITIONAL_PASS' | 'NEED_REVIEW';

export type OpinionSource =
  | 'HANDOVER_LIST'
  | 'SUBMISSION_FORM'
  | 'OLD_PROCESS'
  | 'SUPPLEMENT_NOTE'
  | 'LATEST_EXPORT';

export type OperationType =
  | 'JUDGE'
  | 'NOTE'
  | 'RERUN'
  | 'SUSPEND'
  | 'CONFIRM_MISSING'
  | 'CONFIRM_BATCH'
  | 'REJECT'
  | 'IMPORT';

export interface Material {
  id: number;
  code: string;
  name: string;
  spec: string;
  specialty: Specialty;
  submissionNo: string;
  sourceForm: string;
  status: MaterialStatus;
  judgeResult: JudgeResult | null;
  isLatestExport: boolean;
  hasMissingBatch: boolean;
  importTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: number;
  materialId: number;
  batchNo: string;
  arrivalDate: string | null;
  inspectReport: boolean;
  qualityCert: boolean;
  status: 'COMPLETE' | 'MISSING';
  missingReason: string | null;
}

export interface Opinion {
  id: number;
  materialId: number;
  source: OpinionSource;
  content: string;
  operator: string;
  isOldProcess: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  materialId: number | null;
  materialCode: string;
  operation: OperationType;
  operator: string;
  operatorRole: 'ENGINEER' | 'PM';
  changeDetail: string;
  sourceTag: OpinionSource | null;
  createdAt: string;
}

export interface SuspendConfirm {
  id: number;
  materialId: number;
  reason: string;
  pmDecision: 'CONFIRM_MISSING' | 'SUPPLEMENT_BATCH' | 'REJECT' | null;
  pmOpinion: string | null;
  pmSignature: string | null;
  status: 'OPEN' | 'RESOLVED';
  createdBy: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface SummaryStat {
  processed: number;
  pending: number;
  suspended: number;
  missing: number;
  awaitingPm: number;
  total: number;
  bySpecialty: Record<Specialty, { total: number; processed: number; missing: number }>;
}

export interface JudgeRequest {
  judgeResult: JudgeResult;
  supplementNote?: string;
  isLatestExport: boolean;
  operator: string;
}

export interface RerunRequest {
  operator: string;
  newOpinions?: Array<{ source: OpinionSource; content: string }>;
}

export interface MaterialDetail extends Material {
  batches: Batch[];
  opinions: Opinion[];
}

export interface ImportItem {
  code: string;
  name: string;
  spec: string;
  specialty: Specialty;
  submissionNo: string;
  sourceForm: string;
  handoverOpinion: string;
  submissionOpinion: string;
  oldOpinionMissing: boolean;
  batches: Array<{
    batchNo: string;
    inspectReport: boolean;
    qualityCert: boolean;
    isMissing: boolean;
    missingReason?: string;
  }>;
  isBoundarySample?: boolean;
}

export enum SubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ATTACHMENT_EXPIRED = 'attachment_expired'
}

export enum ChangeSource {
  USER = 'user',
  SYSTEM = 'system',
  BATCH = 'batch',
  CERTIFICATE_ISSUE = 'certificate_issue'
}

export enum BatchActionType {
  APPROVE = 'approve',
  REJECT = 'reject',
  REPROCESS = 'reprocess'
}

export interface RuleVersion {
  id: string;
  version: string;
  name: string;
  description: string;
  rules: RuleDefinition;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
}

export interface RuleDefinition {
  attachmentValidDays: number;
  requireStudentId: boolean;
  requireCourseCode: boolean;
  minPageCount: number;
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  customChecks?: CustomCheck[];
}

export interface CustomCheck {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface Submission {
  id: string;
  batchId: string;
  studentId: string;
  studentName: string;
  courseCode: string;
  courseName: string;
  content: string;
  attachments: Attachment[];
  ruleVersionId: string;
  status: SubmissionStatus;
  summary?: string;
  conclusion?: string;
  processingTime?: number;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  expireAt: Date;
  isExpired: boolean;
}

export interface BatchActionPreview {
  actionType: BatchActionType;
  affectedCount: number;
  affectedIds: string[];
  sampleSubmissions: Submission[];
  estimatedTime: number;
  warnings: string[];
}

export interface HistoryRecord {
  id: string;
  submissionId: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  changeReason: string;
  sourceSystem: string;
  changedBy: string;
  changedAt: Date;
}

export interface DependencyChange {
  id: string;
  dependencyName: string;
  oldVersion: string;
  newVersion: string;
  changeReason: string;
  requester: string;
  approver?: string;
  requestedAt: Date;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
  bothConfirmed: boolean;
}

export interface ProcessReport {
  id: string;
  batchId: string;
  beforeStats: ProcessStats;
  afterStats: ProcessStats;
  executionTime: number;
  processedCount: number;
  nextSuggestions: string[];
  ruleVersionUsed: string;
  generatedAt: Date;
}

export interface ProcessStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  attachmentExpired: number;
}

export interface Database {
  init(): Promise<void>;
  close(): Promise<void>;
}

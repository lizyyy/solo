export type QAStatus = 'normal' | 'pending' | 'confirmed' | 'rejected' | 'known_issue';

export type ReviewType = 'gray_conflict' | 'source_broken' | 'sensitive_leak';

export type ImportStatus = 'success' | 'partial' | 'failed' | 'rolled_back';

export type DuplicateStrategy = 'skip' | 'overwrite' | 'keep_both';

export interface ContractClause {
  id: string;
  clauseNumber: string;
  content: string;
  source: string;
  sourceLink: string;
  importDate: string;
  importBatchId: string;
}

export interface QARecord {
  id: string;
  clauseId: string;
  question: string;
  answer: string;
  status: QAStatus;
  judgmentReason: string;
  grayConclusion: string;
  reportConclusion: string;
  isGrayConflict: boolean;
  isSourceBroken: boolean;
  isSensitiveLeak: boolean;
  sensitiveWordsFound: string[];
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface ImportLog {
  id: string;
  batchId: string;
  fileName: string;
  totalCount: number;
  duplicateCount: number;
  newCount: number;
  status: ImportStatus;
  importDate: string;
  operator: string;
  snapshot: string[];
}

export interface ReviewLog {
  id: string;
  recordId: string;
  reviewType: ReviewType;
  reason: string;
  evidence: string;
  nextStep: string;
  result: QAStatus;
  reviewDate: string;
  reviewer: string;
}

export interface SensitiveWord {
  id: string;
  word: string;
  category: string;
  isActive: boolean;
}

export interface DetectionResult {
  isSourceBroken: boolean;
  sourceBrokenReason: string;
  isGrayConflict: boolean;
  grayConflictReason: string;
  isSensitiveLeak: boolean;
  sensitiveWordsFound: string[];
  sensitiveLeakReason: string;
  overallStatus: QAStatus;
  judgmentReason: string;
}

export interface DashboardMetrics {
  pendingCount: number;
  grayConflictCount: number;
  sensitiveLeakCount: number;
  sourceBrokenCount: number;
  confirmedCount: number;
  normalCount: number;
  rejectedCount: number;
  knownIssueCount: number;
}

export interface TrendDataPoint {
  date: string;
  grayConflict: number;
  sourceBroken: number;
  sensitiveLeak: number;
}

export interface QAFilter {
  status: QAStatus | 'all';
  search: string;
  dateFrom: string;
  dateTo: string;
  issueType: 'all' | ReviewType;
}

export const STATUS_LABELS: Record<QAStatus, string> = {
  normal: '正常',
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  known_issue: '已知问题',
};

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  gray_conflict: '灰度结论与报表不一致',
  source_broken: '答案来源断链',
  sensitive_leak: '敏感词漏脱敏',
};

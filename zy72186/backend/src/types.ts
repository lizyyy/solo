export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'conflict' | 'need_review';

export type ReviewDecision = 'approve' | 'reject' | 'escalate';

export interface EvidenceSpan {
  start: number;
  end: number;
  text: string;
}

export interface ModelEvidence {
  spans: EvidenceSpan[];
  reasoning: string;
  logId: string;
  timestamp: string;
}

export interface ConflictInfo {
  type: 'missing_ref' | 'manual_override' | 'model_import_mismatch';
  modelClaim: string | null;
  importedClaim: string | null;
  evidenceDiff: string;
  suggestedActions: string[];
}

export interface ReviewRecord {
  id: string;
  sampleId: string;
  reviewer: string;
  decision: ReviewDecision;
  evidence: string;
  timestamp: string;
  comments?: string;
  previousStatus: ReviewStatus;
  newStatus: ReviewStatus;
}

export interface Sample {
  id: string;
  contractId: string;
  contractName: string;
  clauseType: string;
  clauseContent: string;
  fullContractText: string;
  
  modelExtraction: string | null;
  modelConfidence: number | null;
  modelVersion: string | null;
  modelThreshold: number | null;
  modelEvidence: ModelEvidence | null;
  modelLogId: string | null;
  
  manualLabel: string | null;
  manualLabeledBy: string | null;
  manualLabelTime: string | null;
  
  importedLabel: string | null;
  importedSource: string | null;
  
  status: ReviewStatus;
  currentReviewer: string | null;
  reviewHistory: ReviewRecord[];
  
  isDuplicate: boolean;
  duplicateOf: string | null;
  duplicateGroupId: string | null;
  
  isMissingRef: boolean;
  hasManualOverride: boolean;
  hasModelImportConflict: boolean;
  conflictInfo: ConflictInfo | null;
  
  createdAt: string;
  updatedAt: string;
  source: 'model' | 'import' | 'hybrid';
}

export interface ReviewReport {
  totalSamples: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  conflictCount: number;
  needReviewCount: number;
  duplicateCount: number;
  missingRefCount: number;
  manualOverrideCount: number;
  modelImportConflictCount: number;
  samplesByStatus: { status: ReviewStatus; count: number }[];
  samplesByClauseType: { clauseType: string; count: number }[];
  recentReviews: ReviewRecord[];
  reviewerStats: { reviewer: string; count: number }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

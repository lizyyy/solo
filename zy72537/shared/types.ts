export type CheckStatus = 
  | 'pending_import'
  | 'imported'
  | 'pending_review'
  | 'conflict_detected'
  | 'review_confirmed'
  | 'review_rejected'
  | 'pending_recheck'
  | 'rechecked'
  | 'completed';

export type SelfCheckType = 
  | 'duplicate_import'
  | 'model_version_changed'
  | 'recalc_after_supplement'
  | 'export_consistency';

export type SelfCheckStatus = 'pass' | 'warning' | 'error' | 'pending';

export interface ModelVersionInfo {
  version: string;
  params: Record<string, any>;
  tradeOffReason: string;
  timestamp: number;
}

export interface KnowledgeBaseReference {
  id: string;
  link: string;
  title: string;
  sampleId: string;
  modelVersion: string;
  conclusion: string;
  importedAt: number;
  importedBy: string;
}

export interface FeedbackTicket {
  id: string;
  ticketNo: string;
  title: string;
  content: string;
  sampleId: string;
  modelVersion: string;
  conclusion: string;
  feedbackTime: number;
  operator: string;
}

export interface SelfCheckResult {
  type: SelfCheckType;
  status: SelfCheckStatus;
  message: string;
  details?: Record<string, any>;
  checkedAt: number;
}

export interface ConflictEvidence {
  id: string;
  type: 'knowledge_vs_ticket';
  sampleId: string;
  fieldName: string;
  knowledgeValue: string;
  ticketValue: string;
  description: string;
  detectedAt: number;
}

export interface CheckRecord {
  id: string;
  sampleId: string;
  sampleName: string;
  imageUrl: string;
  caption: string;
  
  knowledgeReference?: KnowledgeBaseReference;
  feedbackTicket?: FeedbackTicket;
  
  status: CheckStatus;
  conflicts: ConflictEvidence[];
  selfCheckResults: SelfCheckResult[];
  
  modelVersionInfo: ModelVersionInfo;
  calculationResult: {
    consistencyScore: number;
    isConsistent: boolean;
    details: Record<string, any>;
  };
  
  createdAt: number;
  updatedAt: number;
  currentStep: number;
  
  reviewHistory: Array<{
    action: string;
    operator: string;
    timestamp: number;
    comment?: string;
  }>;
  
  productReviewUpdate?: {
    updatedAt: number;
    updatedBy: string;
    content: string;
  };
}

export interface ExportDetail {
  sampleId: string;
  sampleName: string;
  imageUrl: string;
  caption: string;
  consistencyScore: number;
  isConsistent: boolean;
  status: CheckStatus;
  modelVersion: string;
  knowledgeLink?: string;
  ticketNo?: string;
  conflictCount: number;
  selfCheckWarnings: number;
  selfCheckErrors: number;
  hasModelVersionWarning: boolean;
  modelVersionWarningDetail?: string;
  updatedAt: number;
}

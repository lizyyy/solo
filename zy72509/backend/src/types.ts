export enum ReviewStatus {
  PENDING = 'pending',
  CONFLICT = 'conflict',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  NEED_ALGORITHM_REVIEW = 'need_algorithm_review',
}

export enum SelfCheckType {
  DUPLICATE_IMPORT = 'duplicate_import',
  PHONE_LEAKED = 'phone_leaked',
  RECALC_NEEDED = 'recalc_needed',
  EXPORT_INCONSISTENT = 'export_inconsistent',
}

export interface AnnotationRecord {
  id: string;
  session_id: string;
  user_query: string;
  annotator_comment: string;
  model_output: string;
  phone_number: string;
  is_intercepted: boolean;
  review_status: ReviewStatus;
  conflict_evidence?: string;
  created_at: number;
  updated_at: number;
  imported_from: string;
  version: number;
}

export interface SelfCheckResult {
  id: string;
  record_id: string;
  check_type: SelfCheckType;
  description: string;
  severity: 'high' | 'medium' | 'low';
  is_resolved: boolean;
  created_at: number;
}

export interface ImportResult {
  total: number;
  success: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

export interface ConflictDetail {
  recordId: string;
  sessionId: string;
  annotatorComment: string;
  modelOutput: string;
  evidence: string[];
}

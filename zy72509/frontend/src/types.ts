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

export const statusText: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: '待处理',
  [ReviewStatus.CONFLICT]: '存在冲突',
  [ReviewStatus.CONFIRMED]: '已确认',
  [ReviewStatus.REJECTED]: '已驳回',
  [ReviewStatus.NEED_ALGORITHM_REVIEW]: '待算法复核',
};

export const statusColor: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: 'default',
  [ReviewStatus.CONFLICT]: 'orange',
  [ReviewStatus.CONFIRMED]: 'green',
  [ReviewStatus.REJECTED]: 'red',
  [ReviewStatus.NEED_ALGORITHM_REVIEW]: 'purple',
};

export const selfCheckTypeText: Record<SelfCheckType, string> = {
  [SelfCheckType.DUPLICATE_IMPORT]: '重复导入',
  [SelfCheckType.PHONE_LEAKED]: '手机号漏遮',
  [SelfCheckType.RECALC_NEEDED]: '补录待重算',
  [SelfCheckType.EXPORT_INCONSISTENT]: '导出不一致',
};

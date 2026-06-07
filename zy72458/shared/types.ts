export type ComplaintStatus = 'pending_photo' | 'pending_review' | 'normal' | 'missing_opinion' | 'resolved';

export type ProcessStep = 1 | 2 | 3;

export type OperatorRole = 'manager' | 'secretary';

export type SelfCheckType = 'duplicate_import' | 'missing_opinion' | 'recalc_after_add' | 'export_consistency';

export type CheckStatus = 'pass' | 'warning' | 'error';

export interface ResidentComplaint {
  id: string;
  complaintNo: string;
  originalRowNo: number;
  importTime: string;
  importBy: string;
  currentStep: ProcessStep;
  status: ComplaintStatus;
  isDuplicate?: boolean;
  duplicateOf?: string;
  intersectionPhoto: {
    hasPhoto: boolean;
    photoUrl?: string;
    reviewedBy?: string;
    reviewTime?: string;
  };
  residentOpinion: {
    hasOriginal: boolean;
    summary: string;
    originalText?: string;
  };
  reviewBy?: string;
  reviewTime?: string;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  complaintId: string;
  action: string;
  operator: string;
  operatorRole: OperatorRole;
  beforeChange: Record<string, unknown> | null;
  afterChange: Record<string, unknown> | null;
  timestamp: string;
}

export interface SelfCheckResult {
  checkId: string;
  checkName: string;
  checkType: SelfCheckType;
  status: CheckStatus;
  message: string;
  details: Array<Record<string, unknown>>;
  runTime: string;
}

export interface OperationRecord {
  id: string;
  command: string;
  operator: string;
  timestamp: string;
  parameters: Record<string, unknown>;
  result: 'success' | 'failed';
  errorMessage?: string;
}

export interface ImportComplaintDto {
  complaintNo: string;
  originalRowNo: number;
  residentOpinionSummary: string;
  residentOpinionOriginal?: string;
  intersectionPhotoUrl?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ComplaintWithAudit extends ResidentComplaint {
  auditLogs: AuditLog[];
}

export interface DashboardStats {
  total: number;
  pendingPhoto: number;
  pendingReview: number;
  missingOpinion: number;
  normal: number;
  resolved: number;
  duplicates: number;
}

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending_photo: '待补看照片',
  pending_review: '待复核',
  normal: '正常',
  missing_opinion: '意见只剩汇总',
  resolved: '已结案',
};

export const STATUS_COLORS: Record<ComplaintStatus, string> = {
  pending_photo: 'bg-amber-100 text-amber-800',
  pending_review: 'bg-blue-100 text-blue-800',
  normal: 'bg-green-100 text-green-800',
  missing_opinion: 'bg-red-100 text-red-800',
  resolved: 'bg-gray-100 text-gray-800',
};

export const STEP_LABELS: Record<ProcessStep, string> = {
  1: '第一步：数据导入',
  2: '第二步：补看路口照片',
  3: '第三步：冲突复核表更新',
};

export const SELF_CHECK_NAMES: Record<SelfCheckType, string> = {
  duplicate_import: '重复导入检测',
  missing_opinion: '居民意见缺失检测',
  recalc_after_add: '补录后重算校验',
  export_consistency: '导出一致性校验',
};

export type CaseStatus = 'normal' | 'pending_review' | 'conflict' | 'supplemented';
export type ResultType = 'smooth' | 'summary_only' | 'old_supplemented' | 'conflict_confirmed' | 'conflict_rejected';
export type EvidenceType = 'road_photo' | 'bus_card';
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';

export interface Case {
  id: string;
  title: string;
  address: string;
  status: CaseStatus;
  resultType: ResultType;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  description: string;
  conflictResolved?: boolean;
  conflictResolution?: 'confirmed' | 'rejected' | null;
  finalConclusion?: string;
}

export interface Evidence {
  id: string;
  caseId: string;
  type: EvidenceType;
  source: string;
  title: string;
  description: string;
  hasOriginalText: boolean;
  summary?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ConflictItem {
  id: string;
  caseId: string;
  evidenceAId: string;
  evidenceBId: string;
  conflictPoint: string;
  status: ConflictStatus;
  reviewer?: string;
  reviewedAt?: string;
  remark?: string;
}

export interface HistoryLog {
  id: string;
  caseId: string;
  action: string;
  operator: string;
  timestamp: string;
  detail: string;
}

export const statusLabels: Record<CaseStatus, string> = {
  normal: '正常',
  pending_review: '待社区书记复核',
  conflict: '冲突待复核',
  supplemented: '补录',
};

export const resultTypeLabels: Record<ResultType, string> = {
  smooth: '顺利记录',
  summary_only: '居民意见仅汇总',
  old_supplemented: '旧口径补录',
  conflict_confirmed: '冲突已确认采信',
  conflict_rejected: '冲突已驳回待补',
};

export const resultTypeStyles: Record<ResultType, string> = {
  smooth: 'bg-success-50 text-success-600 border-success-200',
  summary_only: 'bg-warning-50 text-warning-600 border-warning-200',
  old_supplemented: 'bg-primary-50 text-primary-600 border-primary-200',
  conflict_confirmed: 'bg-green-50 text-green-700 border-green-200',
  conflict_rejected: 'bg-orange-50 text-orange-700 border-orange-200',
};

export const evidenceTypeLabels: Record<EvidenceType, string> = {
  road_photo: '路口照片',
  bus_card: '公交刷卡时段',
};

export const conflictStatusLabels: Record<ConflictStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  rejected: '已驳回',
};

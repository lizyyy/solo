export type ReviewStatus = 'draft' | 'in_progress' | 'pending_review' | 'completed';

export type ReviewStep = 'log_import' | 'threshold_note' | 'summary_update';

export type ChangeType = 'create' | 'update' | 'status_change';

export type SummarySource = 'training_log' | 'threshold_note' | 'manual';

export interface Review {
  id: string;
  title: string;
  status: ReviewStatus;
  currentStep: ReviewStep;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignee: string;
  hasDefaultScoreIssue: boolean;
  reviewComment?: string;
}

export interface TrainingLog {
  id: string;
  reviewId: string;
  originalLineNumber: number;
  content: string;
  originalContent: string;
  modifiedBy?: string;
  modifiedAt?: string;
  status: 'original' | 'modified' | 'verified';
  sourceHash: string;
  isModified: boolean;
}

export interface ChangeHistory {
  id: string;
  reviewId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedAt: string;
  changeType: ChangeType;
}

export interface ThresholdNote {
  id: string;
  reviewId: string;
  title: string;
  content: string;
  relatedLogIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface SummaryItem {
  id: string;
  reviewId: string;
  content: string;
  source: SummarySource;
  needsConfirmation: boolean;
  isConfirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface ReviewFullData {
  review: Review;
  trainingLogs: TrainingLog[];
  changeHistories: ChangeHistory[];
  thresholdNotes: ThresholdNote[];
  summaryItems: SummaryItem[];
}

export const STEP_LABELS: Record<ReviewStep, string> = {
  log_import: '导入训练日志',
  threshold_note: '补看阈值笔记',
  summary_update: '更新可解释摘要',
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: '草稿',
  in_progress: '进行中',
  pending_review: '待复核',
  completed: '已完成',
};

export const STATUS_COLORS: Record<ReviewStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending_review: 'bg-orange-50 text-orange-700 border-orange-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
};

export const SOURCE_LABELS: Record<SummarySource, string> = {
  training_log: '训练日志',
  threshold_note: '阈值笔记',
  manual: '人工补充',
};

export const SOURCE_BADGE_COLORS: Record<SummarySource, string> = {
  training_log: 'bg-blue-50 text-blue-700 border-blue-200',
  threshold_note: 'bg-purple-50 text-purple-700 border-purple-200',
  manual: 'bg-gray-50 text-gray-700 border-gray-200',
};

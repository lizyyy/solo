export enum RecordStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  REJECTED = 'rejected',
  REWORK = 'rework',
  WRONG_CRITERIA = 'wrong_criteria',
  PM_REVIEW = 'pm_review',
  REVIEW_PASSED = 'review_passed',
  REVIEW_REJECTED = 'review_rejected'
}

export enum AbnormalType {
  NONE = 'none',
  URL_404_PASSED = 'url_404_passed',
  WRONG_CRITERIA = 'wrong_criteria',
  REWORK_NEEDED = 'rework_needed',
  OTHER = 'other'
}

export interface ModelOutput {
  id: string;
  recordId: string;
  modelName: string;
  outputSnippet: string;
  confidence: number;
  reasoningDetails: Record<string, unknown>;
}

export interface JudgmentLog {
  id: string;
  recordId: string;
  operator: string;
  action: string;
  remark: string;
  fromStatus: RecordStatus;
  toStatus: RecordStatus;
  operatedAt: string;
}

export interface AnnotationRecord {
  id: string;
  originalLineNumber: number;
  annotatorMessage: string;
  referenceUrl: string;
  urlStatus: boolean;
  robotJudgment: string;
  currentStatus: RecordStatus;
  abnormalType: AbnormalType;
  modelOutput?: ModelOutput;
  judgmentLogs: JudgmentLog[];
  rawData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastOperator?: string;
}

export interface ConflictSample {
  id: string;
  recordId: string;
  priority: 'high' | 'medium' | 'low';
  reviewer?: string;
  isRechecked: boolean;
  recheckedAt?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  records: AnnotationRecord[];
  errors: string[];
}

export const StatusLabelMap: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: '待处理',
  [RecordStatus.PASSED]: '通过',
  [RecordStatus.REJECTED]: '驳回',
  [RecordStatus.REWORK]: '补录返工',
  [RecordStatus.WRONG_CRITERIA]: '错口径',
  [RecordStatus.PM_REVIEW]: '待产品经理复核',
  [RecordStatus.REVIEW_PASSED]: '复核通过',
  [RecordStatus.REVIEW_REJECTED]: '复核驳回'
};

export const AbnormalTypeLabelMap: Record<AbnormalType, string> = {
  [AbnormalType.NONE]: '正常',
  [AbnormalType.URL_404_PASSED]: '引用链接404仍被判通过',
  [AbnormalType.WRONG_CRITERIA]: '错口径',
  [AbnormalType.REWORK_NEEDED]: '补录返工',
  [AbnormalType.OTHER]: '其他异常'
};

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

export enum LogAction {
  STATUS_CHANGE = 'status_change',
  BATCH_STATUS_CHANGE = 'batch_status_change',
  MODEL_OUTPUT_FILL = 'model_output_fill',
  MODEL_OUTPUT_UPDATE = 'model_output_update',
  ANNOTATOR_MESSAGE_UPDATE = 'annotator_message_update',
  ROBOT_JUDGMENT_UPDATE = 'robot_judgment_update',
  URL_UPDATE = 'url_update',
  AUTO_DETECT = 'auto_detect',
  ROLLBACK = 'rollback'
}

export interface ModelOutput {
  id: string;
  recordId: string;
  modelName: string;
  outputSnippet: string;
  confidence: number;
  reasoningDetails: Record<string, unknown>;
  filledBy?: string;
  filledAt?: string;
  isBackfill?: boolean;
}

export interface ContentSnapshot {
  annotatorMessage: string;
  referenceUrl: string;
  urlStatus: boolean;
  robotJudgment: string;
  modelOutputSnippet?: string;
  modelOutputName?: string;
  modelOutputConfidence?: number;
  status: RecordStatus;
  abnormalType: AbnormalType;
}

export interface JudgmentLog {
  id: string;
  recordId: string;
  operator: string;
  action: LogAction | string;
  remark: string;
  fromStatus: RecordStatus;
  toStatus: RecordStatus;
  fromSnapshot?: ContentSnapshot;
  toSnapshot?: ContentSnapshot;
  diffSummary?: string[];
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
  modelOutputMissing: boolean;
  judgmentLogs: JudgmentLog[];
  rawData: Record<string, unknown>;
  originalSnapshot: ContentSnapshot;
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

export const LogActionLabelMap: Record<LogAction | string, string> = {
  [LogAction.STATUS_CHANGE]: '状态变更',
  [LogAction.BATCH_STATUS_CHANGE]: '批量状态变更',
  [LogAction.MODEL_OUTPUT_FILL]: '模型输出补录',
  [LogAction.MODEL_OUTPUT_UPDATE]: '模型输出更新',
  [LogAction.ANNOTATOR_MESSAGE_UPDATE]: '标注员留言更新',
  [LogAction.ROBOT_JUDGMENT_UPDATE]: '机器人判断更新',
  [LogAction.URL_UPDATE]: '链接信息更新',
  [LogAction.AUTO_DETECT]: '规则自动检测',
  [LogAction.ROLLBACK]: '回滚操作'
};

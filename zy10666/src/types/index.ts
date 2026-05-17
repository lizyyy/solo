export enum CorrectionStatus {
  CAN_TRY = 'can_try',
  ABNORMAL_PENDING = 'abnormal_pending',
  CORRECTED = 'corrected',
  REVOKED = 'revoked'
}

export const CorrectionStatusLabel: Record<CorrectionStatus, string> = {
  [CorrectionStatus.CAN_TRY]: '可试看',
  [CorrectionStatus.ABNORMAL_PENDING]: '异常待判',
  [CorrectionStatus.CORRECTED]: '已纠偏',
  [CorrectionStatus.REVOKED]: '已撤销'
};

export enum CorrectionReason {
  PAID_USER_BLOCKED_BY_OLD_RULE = 'paid_user_blocked_by_old_rule',
  NEW_RULE_APPLIED = 'new_rule_applied',
  MANUAL_CORRECTION = 'manual_correction',
  DUPLICATE_CONFLICT = 'duplicate_conflict',
  SYSTEM_ERROR = 'system_error',
  DATA_INCONSISTENCY = 'data_inconsistency'
}

export const CorrectionReasonLabel: Record<CorrectionReason, string> = {
  [CorrectionReason.PAID_USER_BLOCKED_BY_OLD_RULE]: '付费用户被旧试看规则限制播放',
  [CorrectionReason.NEW_RULE_APPLIED]: '新试看规则已生效',
  [CorrectionReason.MANUAL_CORRECTION]: '人工手动纠偏',
  [CorrectionReason.DUPLICATE_CONFLICT]: '多系统数据冲突',
  [CorrectionReason.SYSTEM_ERROR]: '系统异常',
  [CorrectionReason.DATA_INCONSISTENCY]: '数据不一致'
};

export enum SourceSystem {
  VOD_BACKEND = 'vod_backend',
  USER_CENTER = 'user_center',
  ORDER_SYSTEM = 'order_system',
  CONTENT_MANAGEMENT = 'content_management',
  IMPORT_BATCH = 'import_batch'
}

export const SourceSystemLabel: Record<SourceSystem, string> = {
  [SourceSystem.VOD_BACKEND]: '视频点播后台',
  [SourceSystem.USER_CENTER]: '用户中心',
  [SourceSystem.ORDER_SYSTEM]: '订单系统',
  [SourceSystem.CONTENT_MANAGEMENT]: '内容管理系统',
  [SourceSystem.IMPORT_BATCH]: '批量导入'
};

export interface VideoInfo {
  videoId: string;
  videoTitle: string;
  videoDuration?: number;
  videoCategory?: string;
}

export interface UserInfo {
  userId: string;
  userName: string;
  userType: 'free' | 'paid' | 'vip';
  isPaid: boolean;
  vipExpireTime?: string;
}

export interface TrialRule {
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  trialDuration?: number;
  trialCount?: number;
  effectiveTime: string;
  expireTime?: string;
}

export interface CorrectionRecord {
  id: string;
  video: VideoInfo;
  user: UserInfo;
  trialRule: TrialRule;
  status: CorrectionStatus;
  correctionReason: CorrectionReason;
  readableReason: string;
  sourceSystem: SourceSystem;
  sourceRecordId?: string;
  conflictInfo?: ConflictInfo;
  operatorId?: string;
  operatorName?: string;
  createdAt: string;
  updatedAt: string;
  remark?: string;
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictRecords: string[];
  conflictSystems: SourceSystem[];
  resolutionStrategy: string;
  resolvedAt?: string;
}

export interface CorrectionHistory {
  id: string;
  recordId: string;
  oldStatus: CorrectionStatus;
  newStatus: CorrectionStatus;
  operatorId?: string;
  operatorName?: string;
  operationRemark?: string;
  createdAt: string;
}

export interface ImportBadRow {
  id: string;
  rowNumber: number;
  rowData: Record<string, unknown>;
  errorMessage: string;
  importedAt: string;
  batchId: string;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  businessCode?: string;
  businessMessage?: string;
}

export interface ListRequest {
  page?: number;
  pageSize?: number;
  status?: CorrectionStatus;
  sourceSystem?: SourceSystem;
  userId?: string;
  videoId?: string;
  keyword?: string;
}

export interface ListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

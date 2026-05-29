export type ConflictType = 'exercise_date_mismatch' | 'withdrawn_still_in_list' | 'insufficient_position';

export type ApplicationStatus = 'pending' | 'confirmed' | 'exercised' | 'withdrawn';

export interface BondPosition {
  bondCode: string;
  bondName: string;
  customerId: string;
  customerName: string;
  positionQuantity: number;
  positionDate: string;
  positionSource: string;
}

export interface AnnouncementVersion {
  versionId: string;
  versionNo: string;
  publishDate: string;
  contentDiff: Record<string, { old: unknown; new: unknown }>;
  operator: string;
}

export interface RedemptionAnnouncement {
  announcementId: string;
  bondCode: string;
  bondName: string;
  exerciseDate: string;
  exercisePrice: number;
  announcementDate: string;
  versionNo: string;
  versions: AnnouncementVersion[];
}

export interface ExerciseApplication {
  applicationId: string;
  bondCode: string;
  customerId: string;
  customerName: string;
  applyQuantity: number;
  applyExerciseDate: string;
  applicationStatus: ApplicationStatus;
  isWithdrawn: boolean;
  withdrawDate?: string;
  createTime: string;
  updateTime: string;
}

export interface ConflictRecord {
  conflictId: string;
  applicationId: string;
  conflictType: ConflictType;
  conflictDetail: string;
  systemSuggestion: string;
  manualJudgment?: string;
  createTime: string;
  operator?: string;
}

export interface StatusChangeLog {
  logId: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changeTime: string;
  operator: string;
  remark?: string;
}

export interface RedemptionListItem {
  applicationId: string;
  bondCode: string;
  bondName: string;
  customerId: string;
  customerName: string;
  positionQuantity: number;
  applyQuantity: number;
  announcementExerciseDate: string;
  applyExerciseDate: string;
  applicationStatus: ApplicationStatus;
  isWithdrawn: boolean;
  conflicts: ConflictType[];
  latestAnnouncementVersion: string;
  lastUpdateTime: string;
}

export interface FilterConditions {
  bondCode?: string;
  customerName?: string;
  exerciseDateStart?: string;
  exerciseDateEnd?: string;
  applicationStatus?: ApplicationStatus[];
  conflictTypes?: ConflictType[];
  positionQuantityMin?: number;
  applyQuantityMin?: number;
}

export interface ExportConfig {
  includeConflicts: boolean;
  includeProcessingHistory: boolean;
  includeAnnouncementVersions: boolean;
  fileFormat: 'xlsx' | 'csv';
}

export interface OperationLog {
  logId: string;
  operationType: 'filter' | 'export' | 'status_change' | 'manual_judgment' | 'announcement_update';
  operator: string;
  operationTime: string;
  description: string;
  detail?: Record<string, unknown>;
}

export interface ExportRecord {
  recordId: string;
  exportTime: string;
  operator: string;
  filterConditions: FilterConditions;
  recordCount: number;
  fileName: string;
}

export interface ConflictDetail {
  type: ConflictType;
  label: string;
  description: string;
  suggestion: string;
  color: string;
}

export const CONFLICT_DETAILS: Record<ConflictType, ConflictDetail> = {
  exercise_date_mismatch: {
    type: 'exercise_date_mismatch',
    label: '行权日错位',
    description: '公告行权日与申请行权日不一致',
    suggestion: '请核实正确的行权日期，必要时联系客户确认',
    color: '#e67e22',
  },
  withdrawn_still_in_list: {
    type: 'withdrawn_still_in_list',
    label: '撤回仍入榜',
    description: '申请已撤回但仍在名单中',
    suggestion: '请确认是否需要移除该申请，或客户已重新提交',
    color: '#e74c3c',
  },
  insufficient_position: {
    type: 'insufficient_position',
    label: '持仓不足',
    description: '申请行权数量大于客户持仓数量',
    suggestion: '请核实客户实际持仓，或与客户确认行权数量',
    color: '#f39c12',
  },
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  exercised: '已行权',
  withdrawn: '已撤回',
};

export const STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ['confirmed', 'withdrawn'],
  confirmed: ['exercised', 'withdrawn'],
  exercised: [],
  withdrawn: [],
};

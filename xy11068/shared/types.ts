export enum ReturnStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  OWNERSHIP_ISSUE = 'ownership_issue',
  PROCESSING = 'processing',
  STORED = 'stored',
  COMPLETED = 'completed',
  ISSUE_RECORDED = 'issue_recorded'
}

export const ReturnStatusLabels: Record<ReturnStatus, string> = {
  [ReturnStatus.DRAFT]: '待提交',
  [ReturnStatus.PENDING]: '待审核',
  [ReturnStatus.APPROVED]: '审核通过',
  [ReturnStatus.REJECTED]: '审核驳回',
  [ReturnStatus.OWNERSHIP_ISSUE]: '归属不清',
  [ReturnStatus.PROCESSING]: '问题处理中',
  [ReturnStatus.STORED]: '设备入库',
  [ReturnStatus.COMPLETED]: '已完成',
  [ReturnStatus.ISSUE_RECORDED]: '问题记录'
};

export type DeviceType = 'adult' | 'child' | 'group';

export const DeviceTypeLabels: Record<DeviceType, string> = {
  adult: '成人讲解器',
  child: '儿童讲解器',
  group: '团体讲解器'
};

export type BatteryStatus = 'full' | 'normal' | 'low' | 'charge';

export const BatteryStatusLabels: Record<BatteryStatus, string> = {
  full: '充足(>80%)',
  normal: '一般(50-80%)',
  low: '偏低(<50%)',
  charge: '需充电'
};

export type DeviceCondition = 'normal' | 'damaged' | 'lost';

export const DeviceConditionLabels: Record<DeviceCondition, string> = {
  normal: '正常',
  damaged: '损坏',
  lost: '丢失'
};

export type SubmitSource = 'web' | 'miniapp' | 'backend';

export const SubmitSourceLabels: Record<SubmitSource, string> = {
  web: 'Web端',
  miniapp: '小程序',
  backend: '后台录入'
};

export type ValidationIssueType = 'ownership' | 'count_mismatch' | 'duplicate' | 'other';

export interface DeviceItem {
  deviceId: string;
  deviceType: DeviceType;
  batteryStatus: BatteryStatus;
  borrowDate: string;
  borrowTeam: string;
  condition: DeviceCondition;
  remarks: string;
}

export interface OperationLog {
  id: string;
  action: string;
  operator: string;
  time: string;
  remarks: string;
}

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: 'warning' | 'error';
  message: string;
  deviceId?: string;
}

export interface ReturnApplication {
  id: string;
  teamName: string;
  responsiblePerson: string;
  phone: string;
  returnDate: string;
  submitSource: SubmitSource;
  submitTime: string;
  operator: string;
  status: ReturnStatus;
  deviceCount: number;
  devices: DeviceItem[];
  operationLogs: OperationLog[];
  validationIssues: ValidationIssue[];
}

export interface StatusTransition {
  from: ReturnStatus;
  to: ReturnStatus;
  action: string;
  allowed: boolean;
  requiresReason: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

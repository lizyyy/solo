export type OrderStatus = 'pending' | 'processing' | 'completed' | 'abnormal';
export type Judgment = 'normal' | 'abnormal' | 'pending_review';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Shift = 'morning' | 'afternoon' | 'night';

export interface MaintenancePhoto {
  id: string;
  workOrderId: string;
  url: string;
  thumbnail: string;
  description: string;
  uploadTime: string;
  isLateArrival: boolean;
  hitsOldTerminology: boolean;
  exifInfo?: {
    device?: string;
    gps?: string;
    originalTime?: string;
  };
}

export interface JudgmentRecord {
  id: string;
  workOrderId: string;
  operator: string;
  operatorRole: 'reviewer' | 'supervisor';
  oldJudgment: Judgment | null;
  newJudgment: Judgment;
  reason: string;
  changedAt: string;
  shift: Shift;
}

export interface WorkOrderAttachment {
  id: string;
  filename: string;
  uploadTime: string;
  isLateArrival: boolean;
}

export interface WorkOrder {
  id: string;
  orderNo: string;
  deviceNo: string;
  deviceName: string;
  faultType: string;
  faultDescription: string;
  reportTime: string;
  reporter: string;
  status: OrderStatus;
  priority: Priority;
  manualRemark: string;
  judgment: Judgment;
  judgmentBy: string | null;
  judgmentAt: string | null;
  shift: Shift;
  isDuplicateWarning: boolean;
  duplicateAction?: 'skip' | 'merge' | 'overwrite';
  photos: MaintenancePhoto[];
  attachments: WorkOrderAttachment[];
  judgmentHistory: JudgmentRecord[];
}

export interface FilterState {
  dateRange: [string, string] | null;
  searchKeyword: string | null;
  exactDeviceNo: string | null;
  status: OrderStatus | null;
  judgment: Judgment | null;
  shift: Shift | null;
  priority: Priority | null;
  hasLateArrival: boolean | null;
  hitsOldTerminology: boolean | null;
}

export interface Statistics {
  total: number;
  normal: number;
  abnormal: number;
  pending: number;
  lateArrivalCount: number;
  oldTerminologyHits: number;
  duplicateWarnings: number;
}

export interface DuplicateWarning {
  deviceNo: string;
  existingOrderId: string;
  newOrderId: string;
  existingOrderNo: string;
  newOrderNo: string;
  suggestion: 'skip' | 'merge' | 'overwrite';
  nextStepText: string;
}

export interface DuplicateResolutionResult {
  imported: number;
  skipped: number;
  merged: number;
  overwritten: number;
  warnings: DuplicateWarning[];
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  abnormal: '异常',
};

export const JUDGMENT_LABELS: Record<Judgment, string> = {
  normal: '正常',
  abnormal: '异常',
  pending_review: '待复核',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: '早班',
  afternoon: '中班',
  night: '夜班',
};

export type RecordStatus = 'pending' | 'approved' | 'rejected' | 'duplicate' | 'manual';

export type RecordType = 'normal' | 'late_attachment' | 'duplicate' | 'manual_correction';

export type UserRole = 'analyst' | 'manager';

export interface AuditRecord {
  id: string;
  source: string;
  content: string;
  status: RecordStatus;
  type: RecordType;
  pendingReason: string;
  handlerId: string | null;
  handlerName: string | null;
  sourceChain: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeHistory {
  id: string;
  recordId: string;
  fromStatus: RecordStatus | null;
  toStatus: RecordStatus;
  reason: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface FilterConditions {
  status: RecordStatus | 'all';
  source: string;
  type: RecordType | 'all';
  handlerId: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  total: number;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已驳回',
  duplicate: '重复项',
  manual: '人工更正',
};

export const TYPE_LABELS: Record<RecordType, string> = {
  normal: '正常记录',
  late_attachment: '晚到附件',
  duplicate: '重复项',
  manual_correction: '人工更正',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  pending: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  duplicate: 'bg-gray-100 text-gray-800',
  manual: 'bg-blue-100 text-blue-800',
};

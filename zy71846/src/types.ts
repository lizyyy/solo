export type RecordStatus = 'normal' | 'pending' | 'reviewed' | 'closed';
export type RecordSource = 'initial' | 'late_attachment' | 'duplicate' | 'manual_correction';
export type UserRole = 'exhibit_engineer' | 'project_lead' | 'docent';

export interface PlacementRecord {
  id: string;
  cabinetId: string;
  artifactName: string;
  artifactCode: string;
  position: string;
  coordinateAxis: string;
  axisFlipped: boolean;
  status: RecordStatus;
  source: RecordSource;
  pendingReason: string;
  reviewResult: 'confirmed' | 'rejected' | null;
  reviewComment: string;
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
  createdBy: string;
  isDisputed: boolean;
}

export interface ModificationHistory {
  id: string;
  recordId: string;
  operator: string;
  operatorRole: UserRole;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  normal: '正常',
  pending: '待处理',
  reviewed: '已复核',
  closed: '已关闭',
};

export const SOURCE_LABELS: Record<RecordSource, string> = {
  initial: '初始录入',
  late_attachment: '晚到附件',
  duplicate: '重复项',
  manual_correction: '人工更正',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  exhibit_engineer: '布展工程师',
  project_lead: '工程负责人',
  docent: '讲解员',
};

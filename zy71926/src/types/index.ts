export type RegistrationStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'swapped'
  | 'missing'
  | 'cancelled';

export type AnomalyType =
  | 'duplicate'
  | 'late_attachment'
  | 'missing_info'
  | 'conflict'
  | 'swap_record';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export type DataSource = 'manual' | 'import' | 'correction';

export interface Registration {
  id: string;
  artworkName: string;
  artist: string;
  registrant: string;
  contact: string;
  status: RegistrationStatus;
  location?: string;
  notes?: string;
  attachmentUrl?: string;
  attachmentReceivedAt?: string;
  source: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistory {
  id: string;
  registrationId: string;
  fromStatus: RegistrationStatus | null;
  toStatus: RegistrationStatus;
  operator: string;
  reason: string;
  swapFrom?: string;
  swapTo?: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Anomaly {
  id: string;
  registrationId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  rule: string;
  suggestion: string;
  detectedAt: string;
  resolvedAt?: string;
  resolver?: string;
}

export interface ExportRecord {
  exportId: string;
  exportedAt: string;
  exportedBy: string;
  filterCriteria: string;
  count: number;
}

export interface StatusMeta {
  label: string;
  color: string;
  tagClass: string;
}

export interface AnomalyMeta {
  label: string;
  shortLabel: string;
  severity: AnomalySeverity;
}

export const STATUS_META: Record<RegistrationStatus, StatusMeta> = {
  pending: { label: '待确认', color: '#f59e0b', tagClass: 'tag-warning' },
  confirmed: { label: '已确认', color: '#3b82f6', tagClass: 'tag-info' },
  arrived: { label: '已到场', color: '#10b981', tagClass: 'tag-success' },
  swapped: { label: '已调换', color: '#a855f7', tagClass: 'tag-danger' },
  missing: { label: '缺失', color: '#ef4444', tagClass: 'tag-danger' },
  cancelled: { label: '已取消', color: '#64748b', tagClass: 'tag-muted' },
};

export const ANOMALY_META: Record<AnomalyType, AnomalyMeta> = {
  duplicate: { label: '重复项', shortLabel: '重', severity: 'high' },
  late_attachment: { label: '晚到附件', shortLabel: '晚', severity: 'medium' },
  missing_info: { label: '信息缺失', shortLabel: '缺', severity: 'high' },
  conflict: { label: '展位冲突', shortLabel: '冲', severity: 'high' },
  swap_record: { label: '调换记录', shortLabel: '调', severity: 'medium' },
};

export const ANOMALY_SEVERITY_META: Record<AnomalySeverity, { label: string; color: string }> = {
  low: { label: '低', color: '#3b82f6' },
  medium: { label: '中', color: '#f59e0b' },
  high: { label: '高', color: '#ef4444' },
};

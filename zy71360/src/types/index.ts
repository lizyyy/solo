export type UserRole = 'director' | 'storyboard-artist' | 'art-director' | 'viewer';
export type ShotStatus = 'draft' | 'review' | 'locked';
export type AuditAction = 'create' | 'edit' | 'lock' | 'unlock' | 'rollback' | 'compare' | 'export';
export type ExportFormat = 'markdown' | 'csv' | 'json';
export type ReportType = 'changes' | 'monthly' | 'custom';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface FieldChange {
  id: string;
  versionId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  diff: string;
  reason: string;
  modifiedBy: string;
  modifiedAt: string;
}

export interface ShotVersion {
  id: string;
  shotId: string;
  version: string;
  majorVersion: number;
  minorVersion: number;
  title: string;
  storyboardImage?: string;
  duration: number;
  dialogue: string;
  actionDescription: string;
  artNotes: string;
  vfxNotes: string;
  referenceLinks: string;
  createdBy: string;
  createdAt: string;
  rollbackFromVersionId?: string;
  rollbackReason?: string;
  changeSummary: string;
  fieldChanges: FieldChange[];
}

export interface Shot {
  id: string;
  shotNumber: string;
  scene: string;
  sequence: number;
  currentVersionId: string;
  status: ShotStatus;
  lockedBy?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
  versions: ShotVersion[];
}

export interface AuditLog {
  id: string;
  shotId: string;
  shotNumber?: string;
  versionId?: string;
  action: AuditAction;
  userId: string;
  userName: string;
  userRole: UserRole;
  message: string;
  timestamp: string;
  details: Record<string, any>;
  reason: string;
  versionFrom?: string;
  versionTo?: string;
  fieldChanges?: number;
  isRollback?: boolean;
}

export interface ReportContent {
  summary: {
    totalShots: number;
    newShots: number;
    totalVersions: number;
    edits: number;
    rollbacks: number;
    locks: number;
    unlocks: number;
  };
  shotChanges: Array<{
    shotId: string;
    shotNumber: string;
    changes: FieldChange[];
    versions: string[];
  }>;
  rollbackDetails: Array<{
    shotId: string;
    shotNumber: string;
    fromVersion: string;
    toVersion: string;
    reason: string;
    timestamp: string;
  }>;
  auditTrail: AuditLog[];
}

export interface ExportReport {
  id: string;
  title: string;
  type: ReportType;
  startDate: string;
  endDate: string;
  filters: Record<string, any>;
  content: ReportContent;
  createdBy: string;
  createdAt: string;
}

export interface DiffResult {
  fieldName: string;
  oldValue: string;
  newValue: string;
  changes: Array<{
    type: 'added' | 'removed' | 'unchanged';
    value: string;
  }>;
}

export interface AppState {
  currentUser: User;
  shots: Shot[];
  auditLogs: AuditLog[];
  exportReports: ExportReport[];
  selectedShotId?: string;
  selectedVersionId?: string;
  filters: {
    search: string;
    scene: string;
    status: ShotStatus | 'all';
    modifiedBy: string;
    dateRange: [string, string] | null;
  };
}

export const FIELD_LABELS: Record<string, string> = {
  title: '镜头标题',
  storyboardImage: '分镜图',
  duration: '时长(秒)',
  dialogue: '台词',
  actionDescription: '动作描述',
  artNotes: '美术备注',
  vfxNotes: '特效说明',
  referenceLinks: '参考资料',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  director: '导演',
  'storyboard-artist': '分镜师',
  'art-director': '美术指导',
  viewer: '观察者',
};

export const STATUS_LABELS: Record<ShotStatus, string> = {
  draft: '草稿',
  review: '待审',
  locked: '已锁定',
};

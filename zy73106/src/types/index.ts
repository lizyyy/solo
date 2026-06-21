export type UserRole = 'engineer' | 'manager' | 'viewer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

export type DrawingStatus = 'normal' | 'abnormal' | 'reviewing' | 'closed';

export interface DrawingVersion {
  id: string;
  drawingId: string;
  version: string;
  uploadedBy: string;
  uploadedAt: string;
  isLatest: boolean;
  fileName: string;
  fileSize: number;
  changeLog: string;
}

export type NoteTag = 'initial' | 'supplement' | 'review' | 'fix';

export interface NoteBlock {
  id: string;
  drawingId: string;
  versionId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  tag: NoteTag;
  isRawBimClue: boolean;
}

export interface MaterialBatch {
  id: string;
  drawingId: string;
  batchNo: string;
  materialName: string;
  isMissing: boolean;
  reviewHint?: string;
  suppliedAt?: string;
  recordedBy: string;
}

export interface ValueChangeLog {
  id: string;
  drawingId: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: number;
  newValue: number;
  reason: string;
  operatorId: string;
  operatorName: string;
  changedAt: string;
}

export interface DrawingMetrics {
  collisionPoints: number;
  unqualifiedItems: number;
  sunShadowRisk: number;
  volumeDeviation: number;
}

export interface Drawing {
  id: string;
  projectNo: string;
  name: string;
  buildingName: string;
  status: DrawingStatus;
  currentVersionId: string;
  metrics: DrawingMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface ExportLog {
  id: string;
  type: 'pdf' | 'csv' | 'json';
  drawingId?: string;
  operatorName: string;
  exportedAt: string;
  fileName: string;
}

export interface AppState {
  currentUser: User;
  drawings: Drawing[];
  versions: DrawingVersion[];
  notes: NoteBlock[];
  materials: MaterialBatch[];
  changeLogs: ValueChangeLog[];
  exportLogs: ExportLog[];
}

export const METRIC_FIELD_LABELS: Record<keyof DrawingMetrics, string> = {
  collisionPoints: '碰撞点数',
  unqualifiedItems: '不合格项',
  sunShadowRisk: '日照阴影风险',
  volumeDeviation: '体量偏差(%)',
};

export const STATUS_LABELS: Record<DrawingStatus, string> = {
  normal: '正常',
  abnormal: '异常',
  reviewing: '复核中',
  closed: '已闭环',
};

export const NOTE_TAG_LABELS: Record<NoteTag, string> = {
  initial: '初始判断',
  supplement: '后补材料',
  review: '复核意见',
  fix: '处理记录',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  engineer: '结构工程师',
  manager: '项目负责人',
  viewer: '只读查看',
};

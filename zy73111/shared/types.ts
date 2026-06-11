export type CollisionStatus = 'pending' | 'processing' | 'resolved' | 'waived';

export type MaterialType = 'bim_note' | 'boundary_sample' | 'verbal_note' | 'supplement';

export type ChangeType =
  | 'remark'
  | 'conclusion'
  | 'status'
  | 'abnormal'
  | 'material_add'
  | 'material_modify';

export interface Collision {
  id: string;
  coordinateX: number;
  coordinateY: number;
  coordinateZ: number;
  floor: string;
  discipline: string;
  status: CollisionStatus;
  conclusion: string;
  remark: string;
  isAbnormal: boolean;
  abnormalReason?: string;
  cameraPosition: { px: number; py: number; pz: number };
  cameraTarget: { tx: number; ty: number; tz: number };
  cameraFov: number;
  screenshotUrl: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedByName: string;
  lastModifiedAt: string;
  version: number;
}

export interface Material {
  id: string;
  collisionId: string;
  type: MaterialType;
  typeLabel: string;
  content: string;
  md5: string;
  uploader: string;
  uploaderName: string;
  uploadedAt: string;
  version: number;
  previousId?: string;
  isModifiedSinceLast: boolean;
}

export interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface VersionSnapshot {
  id: string;
  collisionId: string;
  version: number;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  changeType: ChangeType;
  changeReason?: string;
  fieldDiffs: FieldDiff[];
  snapshot: Partial<Collision>;
}

export interface AuditLog {
  id: string;
  collisionId: string;
  action: string;
  actionBadgeColor: string;
  operator: string;
  operatorName: string;
  timestamp: string;
  reason?: string;
  detail: string;
}

export interface ExportRow {
  collisionId: string;
  coordinate: string;
  floor: string;
  discipline: string;
  status: string;
  bimNoteOriginal: string;
  remark: string;
  conclusion: string;
  isAbnormal: boolean;
  abnormalReason?: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  lastModifiedByName: string;
}

export interface UserInfo {
  id: string;
  name: string;
  role: 'designer' | 'engineer' | 'auditor';
}

export interface CollisionQuery {
  floor?: string;
  discipline?: string;
  status?: CollisionStatus;
  isAbnormal?: boolean | string;
  keyword?: string;
}

export interface PatchCollisionPayload {
  remark?: string;
  status?: CollisionStatus;
  conclusion?: string;
  isAbnormal?: boolean;
  abnormalReason?: string;
  changeReason?: string;
  changedBy?: string;
  changedByName?: string;
}

export interface CreateMaterialPayload {
  collisionId: string;
  type?: MaterialType;
  content?: string;
  uploader?: string;
  uploaderName?: string;
  changeReason?: string;
}

export interface AuditLogQuery {
  collisionId?: string;
  operator?: string;
  actionType?: string;
  from?: string;
  to?: string;
}

export type SourceType = 'edit_point' | 'ad_script' | 'audio_track';

export type ChangeType = 'material_only' | 'conclusion_change';

export type ClipStatus = 'pending_ad_script' | 'pending_review' | 'pending' | 'ready' | 'archived';

export type UserRole = 'editor' | 'operator' | 'producer' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface Material {
  id: string;
  clipId: string;
  name: string;
  sourceType: SourceType;
  status: 'available' | 'missing';
  url?: string;
  uploadedBy?: string;
  uploadedAt?: Date;
  remark?: string;
}

export interface ChangeLog {
  id: string;
  clipId: string;
  operatorId: string;
  operatorName: string;
  changeType: ChangeType;
  sourceType: SourceType;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  timestamp: Date;
}

export interface PendingReason {
  id: string;
  clipId: string;
  operatorId: string;
  operatorName: string;
  reason: string;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface Clip {
  id: string;
  title: string;
  guest: string;
  episode: string;
  duration: number;
  status: ClipStatus;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  editPointContent?: string;
  adScriptContent?: string;
  audioTrackBefore?: string;
  audioTrackAfter?: string;
  pendingReasons: PendingReason[];
  changeLogs: ChangeLog[];
  materials: Material[];
}

export interface ExportMissingItem {
  materialId: string;
  materialName: string;
  sourceType: SourceType;
  responsiblePerson: User;
}

export interface ExportManifest {
  id: string;
  clipIds: string[];
  generatedAt: Date;
  generatedBy: string;
  missingItems: ExportMissingItem[];
  canExport: boolean;
}

export interface CreateClipRequest {
  title: string;
  guest: string;
  episode: string;
  duration: number;
  editPointContent: string;
  operatorId: string;
}

export interface UpdateClipRequest {
  title?: string;
  guest?: string;
  episode?: string;
  duration?: number;
  editPointContent?: string;
  adScriptContent?: string;
  audioTrackBefore?: string;
  audioTrackAfter?: string;
  changeType: ChangeType;
  sourceType: SourceType;
  reason?: string;
  operatorId: string;
}

export interface UpdateStatusRequest {
  status: ClipStatus;
  reason?: string;
  operatorId: string;
}

export interface AddMaterialRequest {
  name: string;
  sourceType: SourceType;
  url?: string;
  remark?: string;
  operatorId: string;
}

export interface ExportCheckRequest {
  clipIds: string[];
  operatorId: string;
}

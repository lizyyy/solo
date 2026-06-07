export type ConstructionType = 'road' | 'ramp' | 'pipeline' | 'landscape';
export type NoticeStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type RampType = 'step_free' | 'slope' | 'elevator';
export type RampStatus = 'normal' | 'under_maintenance' | 'closed';
export type PointStatus = 'normal' | 'warning' | 'pending_review' | 'exception';
export type PointType = 'notice' | 'ramp' | 'both';
export type NextHandler = 'planner' | 'resident_rep' | 'admin';
export type ReviewTaskType = 'detour_not_synced' | 'data_conflict' | 'manual_review';
export type ReviewTaskStatus = 'pending' | 'approved' | 'rejected';
export type EntityType = 'notice' | 'ramp' | 'point';
export type ActionType = 'create' | 'update' | 'delete' | 'import';
export type UserRole = 'planner' | 'resident_rep' | 'admin';

export interface ConstructionNotice {
  id: string;
  title: string;
  noticeNo: string;
  constructionType: ConstructionType;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  status: NoticeStatus;
  importHash: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeVersion {
  id: string;
  noticeId: string;
  version: number;
  content: Partial<ConstructionNotice>;
  remark: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface RampRecord {
  id: string;
  location: string;
  rampType: RampType;
  slope: string;
  width: string;
  hasHandrail: boolean;
  status: RampStatus;
  remark: string;
  relatedNoticeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RampVersion {
  id: string;
  rampId: string;
  version: number;
  content: Partial<RampRecord>;
  remark: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface Point {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  type: PointType;
  status: PointStatus;
  keepReason: string;
  missingMaterials: string[];
  nextHandler: NextHandler;
  noticeId?: string;
  rampId?: string;
  detourSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewTask {
  id: string;
  pointId: string;
  pointName: string;
  type: ReviewTaskType;
  status: ReviewTaskStatus;
  description: string;
  assignee: string;
  assigneeName: string;
  reviewerOpinion?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface ChangeLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: ActionType;
  beforeChange: Record<string, any> | null;
  afterChange: Record<string, any>;
  operatorId: string;
  operatorName: string;
  reason: string;
  affectedResults: string[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface ImportResult {
  success: number;
  duplicate: number;
  failed: number;
  duplicateItems: string[];
}

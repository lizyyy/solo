export type ContentType = 'AD' | 'ACTIVITY' | 'EMERGENCY';
export type ScheduleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'CANCELLED' | 'REJECTED';
export type ScreenStatus = 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE';
export type ContentStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface Screen {
  id: string;
  code: string;
  name: string;
  location: string;
  status: ScreenStatus;
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  width: number;
  height: number;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Content {
  id: string;
  title: string;
  type: ContentType;
  description: string;
  fileUrl?: string;
  status: ContentStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  code: string;
  contentId: string;
  screenIds: string[];
  startTime: string;
  endTime: string;
  priority: number;
  status: ScheduleStatus;
  isEmergency: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface HistoryRecord {
  id: string;
  entityType: 'screen' | 'content' | 'schedule';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'cancel' | 'approve' | 'reject' | 'publish';
  beforeData?: any;
  afterData?: any;
  operator: string;
  timestamp: string;
  description: string;
}

export interface AppState {
  isFrozen: boolean;
  frozenBy?: string;
  frozenAt?: string;
  frozenReason?: string;
}

export interface Conflict {
  schedule1: Schedule;
  schedule2: Schedule;
  screenId: string;
  type: 'TIME_OVERLAP' | 'PRIORITY_CONFLICT';
  description: string;
}

export interface PriorityRule {
  id: string;
  name: string;
  priority: number;
  contentType?: ContentType;
  isEmergency: boolean;
  conditions?: string;
  description: string;
}

export const DEFAULT_PRIORITY_RULES: PriorityRule[] = [
  { id: 'rule-1', name: '紧急通知', priority: 100, isEmergency: true, description: '最高优先级，立即插播' },
  { id: 'rule-2', name: '紧急活动', priority: 80, contentType: 'ACTIVITY', isEmergency: true, description: '紧急活动通知' },
  { id: 'rule-3', name: '普通活动', priority: 50, contentType: 'ACTIVITY', isEmergency: false, description: '常规活动排期' },
  { id: 'rule-4', name: '普通广告', priority: 30, contentType: 'AD', isEmergency: false, description: '常规广告排期' },
  { id: 'rule-5', name: '普通通知', priority: 20, contentType: 'EMERGENCY', isEmergency: false, description: '非紧急通知' },
];


export interface Project {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'reviewing';
  createdAt: string;
}

export type DataSource = 'normal' | 'wrong' | 'supplement';

export interface BusSwipeRecord {
  id: string;
  projectId: string;
  cardId: string;
  swipeTime: string;
  route: string;
  location: string;
  source: DataSource;
  isDuplicate?: boolean;
}

export interface RedlineNote {
  id: string;
  projectId: string;
  areaName: string;
  remark: string;
  boundaryCoords: string;
  recordDate: string;
  source: DataSource;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  value: number;
  time: string;
  areaName?: string;
}

export interface HeatmapData {
  id: string;
  projectId: string;
  version: string;
  data: HeatmapPoint[];
  hasLowSampling: boolean;
  lowSamplingAreas?: string[];
  status: 'draft' | 'pending_review' | 'confirmed';
  createdAt: string;
}

export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';

export interface ConflictRecord {
  id: string;
  projectId: string;
  busSwipeId: string;
  redlineNoteId: string;
  description: string;
  evidence: {
    busSwipe: BusSwipeRecord;
    redlineNote: RedlineNote;
    contradiction: string;
  };
  status: ConflictStatus;
  resolvedBy?: string;
  resolvedAt?: string;
}

export type SelfCheckType = 'duplicate' | 'low_sampling' | 'recalculation' | 'export_consistency';
export type SelfCheckStatus = 'pass' | 'warning' | 'error';

export interface SelfCheckResult {
  type: SelfCheckType;
  name: string;
  status: SelfCheckStatus;
  message: string;
  details?: any;
}

export interface OperationLog {
  id: string;
  projectId: string;
  action: string;
  operator: string;
  details: string;
  createdAt: string;
}

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'done';
  relatedPage?: string;
}

export type ChangeTargetType = 'bus_swipe' | 'redline_note' | 'heatmap' | 'conflict';

export interface FieldChange {
  field: string;
  fieldLabel: string;
  before: string;
  after: string;
}

export interface DataChangeRecord {
  id: string;
  projectId: string;
  targetType: ChangeTargetType;
  targetId: string;
  action: 'create' | 'update' | 'delete' | 'import';
  operator: string;
  reason?: string;
  changes: FieldChange[];
  snapshotBefore?: any;
  snapshotAfter?: any;
  createdAt: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  duplicateIds: string[];
  conflictsDetected: number;
  heatmapRecalculated: boolean;
  newHeatmapVersion?: string;
}

export type ProjectStatus = 'pending' | 'processing' | 'reviewing' | 'completed';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
}

export type DataSource = 'normal' | 'wrong' | 'supplement';

export interface BusSwipeRecord {
  id: string;
  projectId?: string;
  cardId: string;
  swipeTime: string;
  route: string;
  location: string;
  areaName?: string;
  hourOfDay?: number;
  isNight?: boolean;
  source: DataSource;
  sourceFile?: string;
  importedAt?: string;
  status?: string;
  isDuplicate?: boolean;
}

export interface RedlineNote {
  id: string;
  projectId?: string;
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
  areaName: string;
  busSwipeId: string;
  cardId: string;
  hourOfDay: number;
  isNight: boolean;
  source: DataSource;
}

export interface AreaHeatmapStats {
  areaName: string;
  totalRecords: number;
  dayRecords: number;
  nightRecords: number;
  avgValue: number;
  maxValue: number;
  hasLowSampling: boolean;
}

export type HeatmapStatus = 'pending_review' | 'confirmed' | 'rejected';
export type HeatmapSource = 'initial' | 'supplement' | 'manual';

export interface HeatmapData {
  id: string;
  projectId?: string;
  version: string;
  source?: HeatmapSource;
  data: HeatmapPoint[];
  points?: HeatmapPoint[];
  areaStats: AreaHeatmapStats[];
  sourceBusSwipeIds?: string[];
  sourceBusCount?: number;
  hasLowSampling: boolean;
  lowSamplingAreas?: string[];
  status: HeatmapStatus;
  createdAt?: string;
  calculatedAt: string;
  isNightLow?: boolean;
  description?: string;
}  projectId?: string;
  action: string;
  operator?: string;
  details: string;
  timestamp?: string;
  createdAt: string;
}

export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'pending' | 'done';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  priority: TodoPriority;
  status: TodoStatus;
  completed?: boolean;
  relatedPage?: string;
}

export interface FieldChange {
  field: string;
  fieldLabel: string;
  before: string;
  after: string;
}

export type ChangeAction = 'import' | 'update' | 'delete' | 'create';
export type ChangeTargetType = 'busSwipe' | 'redline' | 'heatmap' | 'conflict' | 'bus_swipe' | 'redline_note';
export type ChangeStatus = 'pending' | 'confirmed' | 'rejected';

export interface DataChangeRecord {
  id: string;
  projectId?: string;
  targetType: ChangeTargetType;
  targetId: string;
  action: ChangeAction | string;
  changes: FieldChange[];
  reason: string;
  status: ChangeStatus;
  snapshot?: string;
  operator?: string;
  createdAt: string;
}

export interface DuplicateDetail {
  key: string;
  cardId: string;
  swipeTime: string;
}

export interface ImportResult {
  success: boolean;
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  duplicatesDetail?: DuplicateDetail[];
  newIds: string[];
  conflictIds?: string[];
  newHeatmapId?: string | null;
  parseMethod?: 'csv' | 'xlsx';
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  contentPreview: string;
  downloadUrl: string;
}

export interface HeatmapExportRow {
  序号: number;
  区域名称: string;
  热力值: number;
  时段类型: string;
  小时: number;
  坐标X: number;
  坐标Y: number;
  关联公交记录ID: string;
  关联卡号: string;
  关联刷卡时间: string;
  数据口径: DataSource;
  热力图版本: string;
}

export interface HistoryExportRow {
  序号: number;
  变更ID: string;
  变更类型: string;
  操作: string;
  目标ID: string;
  处理人: string;
  处理时间: string;
  修改原因: string;
  状态: string;
  变更字段: string;
  改前值: string;
  改后值: string;
  快照: string;
}

export interface EvidenceChainConflictRef {
  id: string;
  type: string;
  status: string;
}

export interface EvidenceChainChangeRef {
  id: string;
  action: string;
  operator: string;
  reason?: string;
}

export interface EvidenceChainResult {
  valid: boolean;
  error?: string;
  busSwipeId?: string;
  cardId?: string;
  swipeTime?: string;
  areaName?: string;
  heatmapPoints?: number;
  heatmapVersions?: string[];
  conflicts?: EvidenceChainConflictRef[];
  changes?: EvidenceChainChangeRef[];
  evidenceCount?: number;
  summary?: string;
}  id: string;
  projectId?: string;
  action: string;
  operator?: string;
  details: string;
  timestamp?: string;
  createdAt: string;
}

export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'pending' | 'done';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  priority: TodoPriority;
  status: TodoStatus;
  completed?: boolean;
  relatedPage?: string;
}

export interface FieldChange {
  field: string;
  fieldLabel: string;
  before: string;
  after: string;
}

export type ChangeAction = 'import' | 'update' | 'delete' | 'create';
export type ChangeTargetType = 'busSwipe' | 'redline' | 'heatmap' | 'conflict' | 'bus_swipe' | 'redline_note';
export type ChangeStatus = 'pending' | 'confirmed' | 'rejected';

export interface DataChangeRecord {
  id: string;
  projectId?: string;
  targetType: ChangeTargetType;
  targetId: string;
  action: ChangeAction | string;
  changes: FieldChange[];
  reason: string;
  status: ChangeStatus;
  snapshot?: string;
  operator?: string;
  createdAt: string;
}

export interface DuplicateDetail {
  key: string;
  cardId: string;
  swipeTime: string;
}

export interface ImportResult {
  success: boolean;
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  duplicatesDetail?: DuplicateDetail[];
  newIds: string[];
  conflictIds?: string[];
  newHeatmapId?: string | null;
  parseMethod?: 'csv' | 'xlsx';
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  contentPreview: string;
  downloadUrl: string;
}

export interface HeatmapExportRow {
  序号: number;
  区域名称: string;
  热力值: number;
  时段类型: string;
  小时: number;
  坐标X: number;
  坐标Y: number;
  关联公交记录ID: string;
  关联卡号: string;
  关联刷卡时间: string;
  数据口径: DataSource;
  热力图版本: string;
}

export interface HistoryExportRow {
  序号: number;
  变更ID: string;
  变更类型: string;
  操作: string;
  目标ID: string;
  处理人: string;
  处理时间: string;
  修改原因: string;
  状态: string;
  变更字段: string;
  改前值: string;
  改后值: string;
  快照: string;
}

export interface EvidenceChainConflictRef {
  id: string;
  type: string;
  status: string;
}

export interface EvidenceChainChangeRef {
  id: string;
  action: string;
  operator: string;
  reason?: string;
}

export interface EvidenceChainResult {
  valid: boolean;
  error?: string;
  busSwipeId?: string;
  cardId?: string;
  swipeTime?: string;
  areaName?: string;
  heatmapPoints?: number;
  heatmapVersions?: string[];
  conflicts?: EvidenceChainConflictRef[];
  changes?: EvidenceChainChangeRef[];
  evidenceCount?: number;
  summary?: string;
}
  id: string;
  projectId?: string;
  action: string;
  operator?: string;
  details: string;
  timestamp?: string;
  createdAt: string;
}

export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'pending' | 'done';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  priority: TodoPriority;
  status: TodoStatus;
  completed?: boolean;
  relatedPage?: string;
}

export interface FieldChange {
  field: string;
  fieldLabel: string;
  before: string;
  after: string;
}

export type ChangeAction = 'import' | 'update' | 'delete' | 'create';
export type ChangeTargetType = 'busSwipe' | 'redline' | 'heatmap' | 'conflict' | 'bus_swipe' | 'redline_note';
export type ChangeStatus = 'pending' | 'confirmed' | 'rejected';

export interface DataChangeRecord {
  id: string;
  projectId?: string;
  targetType: ChangeTargetType;
  targetId: string;
  action: ChangeAction | string;
  changes: FieldChange[];
  reason: string;
  status: ChangeStatus;
  snapshot?: string;
  operator?: string;
  createdAt: string;
}

export interface DuplicateDetail {
  key: string;
  cardId: string;
  swipeTime: string;
}

export interface ImportResult {
  success: boolean;
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  duplicatesDetail?: DuplicateDetail[];
  newIds: string[];
  conflictIds?: string[];
  newHeatmapId?: string | null;
  parseMethod?: 'csv' | 'xlsx';
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  contentPreview: string;
  downloadUrl: string;
}

export interface HeatmapExportRow {
  序号: number;
  区域名称: string;
  热力值: number;
  时段类型: string;
  小时: number;
  坐标X: number;
  坐标Y: number;
  关联公交记录ID: string;
  关联卡号: string;
  关联刷卡时间: string;
  数据口径: DataSource;
  热力图版本: string;
}

export interface HistoryExportRow {
  序号: number;
  变更ID: string;
  变更类型: string;
  操作: string;
  目标ID: string;
  处理人: string;
  处理时间: string;
  修改原因: string;
  状态: string;
  变更字段: string;
  改前值: string;
  改后值: string;
  快照: string;
}

export interface EvidenceChainConflictRef {
  id: string;
  type: string;
  status: string;
}

export interface EvidenceChainChangeRef {
  id: string;
  action: string;
  operator: string;
  reason?: string;
}

export interface EvidenceChainResult {
  valid: boolean;
  error?: string;
  busSwipeId?: string;
  cardId?: string;
  swipeTime?: string;
  areaName?: string;
  heatmapPoints?: number;
  heatmapVersions?: string[];
  conflicts?: EvidenceChainConflictRef[];
  changes?: EvidenceChainChangeRef[];
  evidenceCount?: number;
  summary?: string;
}
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
  duplicatesDetail: Array<{ cardId: string; swipeTime: string; location: string }>;
  conflictsDetected: number;
  conflictIds: string[];
  heatmapRecalculated: boolean;
  newHeatmapVersion?: string;
  newHeatmapId?: string;
  sourceFile?: string;
  parseMethod?: 'csv' | 'xlsx';
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  contentPreview: string;
  downloadUrl: string;
}

export interface SelfCheckExportConsistencyDetail {
  busCount: number;
  heatmapPointsCount: number;
  matchedPointsCount: number;
  unmatchedCount: number;
  sampleMismatch: any[];
}

export interface SelfCheckResult {
  type: SelfCheckType;
  name: string;
  status: SelfCheckStatus;
  message: string;
  details?: any;
  exportCheck?: SelfCheckExportConsistencyDetail;
  lastRunAt?: string;
}
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
  duplicatesDetail: Array<{ cardId: string; swipeTime: string; location: string }>;
  conflictsDetected: number;
  conflictIds: string[];
  heatmapRecalculated: boolean;
  newHeatmapVersion?: string;
  newHeatmapId?: string;
  sourceFile?: string;
  parseMethod?: 'csv' | 'xlsx';
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  contentPreview: string;
  downloadUrl: string;
}

export interface SelfCheckExportConsistencyDetail {
  busCount: number;
  heatmapPointsCount: number;
  matchedPointsCount: number;
  unmatchedCount: number;
  sampleMismatch: any[];
}

export interface SelfCheckResult {
  type: SelfCheckType;
  name: string;
  status: SelfCheckStatus;
  message: string;
  details?: any;
  exportCheck?: SelfCheckExportConsistencyDetail;
  lastRunAt?: string;
}
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
  duplicatesDetail: Array<{ cardId: string; swipeTime: string; location: string }>;
  conflictsDetected: number;
  conflictIds: string[];
  heatmapRecalculated: boolean;
  newHeatmapVersion?: string;
  newHeatmapId?: string;
  sourceFile?: string;
  parseMethod?: 'csv' | 'xlsx';
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  contentPreview: string;
  downloadUrl: string;
}

export interface SelfCheckExportConsistencyDetail {
  busCount: number;
  heatmapPointsCount: number;
  matchedPointsCount: number;
  unmatchedCount: number;
  sampleMismatch: any[];
}

export interface SelfCheckResult {
  type: SelfCheckType;
  name: string;
  status: SelfCheckStatus;
  message: string;
  details?: any;
  exportCheck?: SelfCheckExportConsistencyDetail;
  lastRunAt?: string;
}

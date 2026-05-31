export type ThresholdLevel = 'normal' | 'warning' | 'danger';

export type SourceType = 'shift_record' | 'work_log' | 'maintenance' | 'maintenance_order';

export type ShiftType = 'day' | 'night';

export type UploadSource = 'original' | 'supplementary';

export type DiffType = 'added' | 'removed' | 'modified';

export type MaintenanceStatus = 'pending' | 'in-progress' | 'completed';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PressureDataPoint {
  timestamp: number;
  pressure: number;
  temperature?: number;
  flowRate?: number;
  timeLabel?: string;
}

export interface ThresholdConfig {
  level: ThresholdLevel;
  min: number;
  max: number;
  color: string;
}

export interface Material {
  id: string;
  batchNo: string;
  name: string;
  spec: string;
  productionDate?: number;
  supplier?: string;
  heatNumber?: string;
  createdAt?: number;
}

export interface Batch {
  id: string;
  materialId: string;
  material?: Material;
  status: 'active' | 'completed' | 'archived';
  startTime: number;
  endTime?: number | null;
  lineNumber?: string;
  createdAt?: number;
}

export interface PressureReading {
  timestamp: number;
  pressure: number;
  location?: string;
}

export interface ShiftRecord {
  id: string;
  batchId?: string;
  shift: ShiftType;
  operator: string;
  recordTime: number;
  content: string;
  pressureReadings?: PressureReading[];
  anomalies?: string;
  hasAbnormal?: boolean;
  abnormalDescription?: string;
  createdAt?: number;
}

export interface WorkLogVersion {
  id: string;
  workLogId: string;
  version: number;
  uploadSource?: UploadSource;
  operator?: string;
  timestamp?: number;
  content: string;
  parsedData?: PressureDataPoint[];
  uploadedAt?: number;
  uploadedBy?: string;
  changeDescription?: string;
}

export interface WorkLog {
  id: string;
  equipmentId: string;
  batchId?: string;
  operator?: string;
  currentVersion: number;
  startTime?: number;
  endTime?: number | null;
  description?: string;
  hasDataChange?: boolean;
  content?: string;
  versions?: WorkLogVersion[];
  createdAt?: number;
}

export interface MaintenanceOrder {
  id: string;
  orderNo: string;
  equipment: string;
  batchId?: string;
  faultDescription: string;
  maintenanceContent: string;
  partsReplaced?: string | null;
  technician: string;
  startTime: number;
  endTime?: number | null;
  status: MaintenanceStatus;
  priority?: 'normal' | 'high';
  relatedPressureValues?: number[];
}

export interface DataSource {
  id: string;
  analysisRunId: string;
  shiftRecordIds: string[];
  workLogIds: string[];
  maintenanceOrderIds: string[];
  timeRangeStart: number;
  timeRangeEnd: number;
}

export interface AnalysisConclusion {
  id: string;
  analysisRunId: string;
  timestamp: number;
  pressure: number;
  thresholdCrossed?: boolean;
  thresholdLevel: ThresholdLevel;
  sourceType: SourceType;
  sourceId: string;
  sourceVersion?: number;
  sourceLine?: number;
  description: string;
  createdAt?: number;
}

export interface SourceStats {
  workLogCount: number;
  shiftRecordCount: number;
  maintenanceCount: number;
}

export interface AnalysisRun {
  id: string;
  batchId: string;
  batch?: Batch;
  version: number;
  analysisTime: number;
  operator: string;
  analyst?: string;
  status: AnalysisStatus;
  waveformData: PressureDataPoint[];
  conclusions: AnalysisConclusion[];
  dataSource?: DataSource;
  overallResult?: string;
  sourceStats: SourceStats;
  analysisDurationMs: number;
  createdAt?: number;
}

export interface VersionDiff {
  line: number;
  type: DiffType;
  oldValue: string;
  newValue: string;
  pressureChange?: number;
  affectsConclusionIds: string[];
}

export interface ChangeNotification {
  id: string;
  workLogId: string;
  workLogVersion: number;
  timestamp: number;
  operator?: string;
  diffs?: VersionDiff[];
  diffSummary?: string;
  affectedConclusionIds: string[];
  reviewed: boolean;
  reviewedBy?: string | null;
  reviewedAt?: number | null;
}

export interface InspectionReport {
  id: string;
  analysisRunId: string;
  generatedAt: number;
  generatedBy: string;
  content: string;
  format: 'text' | 'json';
}

export interface User {
  id: string;
  employeeNo: string;
  name: string;
  role: 'engineer' | 'operator' | 'admin';
}

export interface AppState {
  currentUser: User | null;
  selectedBatchId: string | null;
  selectedAnalysisRunId: string | null;
  activeSourcePanel: SourceType | null;
  selectedConclusionId: string | null;
  notifications: ChangeNotification[];
}

export const THRESHOLDS: ThresholdConfig[] = [
  { level: 'normal', min: 0, max: 8.0, color: '#00d4aa' },
  { level: 'warning', min: 8.0, max: 10.0, color: '#ff9500' },
  { level: 'danger', min: 10.0, max: 100, color: '#ff3b30' },
];

export const SHIFT_LABELS: Record<ShiftType, string> = {
  day: '白班',
  night: '夜班',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  shift_record: '班组记录',
  work_log: '工况日志',
  maintenance: '维修单',
  maintenance_order: '维修单',
};

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  pending: '待处理',
  'in-progress': '进行中',
  completed: '已完成',
};

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  pending: '待分析',
  running: '分析中',
  completed: '已完成',
  failed: '失败',
};

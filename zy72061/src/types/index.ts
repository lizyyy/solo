export type BoneGroup = 'head' | 'spine' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

export type DataSource = 'cad_export' | 'manual_edit' | 'photo_estimate';

export type AnomalyType = 'coordinate_error' | 'missing_data' | 'outlier' | 'suspicious';

export type ChangeType = 'coordinate' | 'anomaly_status' | 'anomaly_type' | 'note' | 'source' | 'import_overwrite' | 'supplement_merge';

export interface CoordinateDiff {
  previous: { x: number; y: number; z: number };
  current: { x: number; y: number; z: number };
  delta: { x: number; y: number; z: number; distance: number };
}

export interface AnomalyStatusDiff {
  previous: boolean;
  current: boolean;
  previousType?: AnomalyType;
  currentType?: AnomalyType;
}

export interface ChangeRecord {
  field: string;
  previous: any;
  current: any;
  reason?: string;
}

export interface ProcessNote {
  id: string;
  pointId: string;
  frameNumber: number;
  content: string;
  author: string;
  createdAt: string;
  changeType?: ChangeType;
  changes?: ChangeRecord[];
  coordinateDiff?: CoordinateDiff;
  anomalyDiff?: AnomalyStatusDiff;
  originalSourceRow?: number;
  originalSourceFile?: string;
}

export interface ModificationStats {
  totalChanges: number;
  coordinateChanges: number;
  anomalyStatusChanges: number;
  noteAdditions: number;
  sourceChanges: number;
  lastModifiedAt: string;
  modifiedBy: string[];
}

export interface SkeletonPoint {
  id: string;
  name: string;
  nameCn: string;
  boneGroup: BoneGroup;
  x: number;
  y: number;
  z: number;
  source: DataSource;
  sourceRow?: number;
  sourceFile?: string;
  importSessionId?: string;
  originalValues: {
    x: number;
    y: number;
    z: number;
    source: DataSource;
    sourceRow?: number;
    sourceFile?: string;
    importSessionId?: string;
  };
  importHistory: ImportRecord[];
  isAnomaly: boolean;
  anomalyType?: AnomalyType;
  anomalyNote?: string;
  notes: ProcessNote[];
  modificationStats: ModificationStats;
  createdAt: string;
  updatedAt: string;
  processedBy?: string;
}

export interface GaitFrame {
  frameId: string;
  frameNumber: number;
  timestamp: number;
  points: SkeletonPoint[];
  source: string;
}

export interface Snapshot {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  frames: GaitFrame[];
  cameraState: CameraState;
  filters: FilterState;
  anomalyCount: number;
  totalPoints: number;
  noteCount: number;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface ViewState {
  camera: CameraState;
  selectedPointId?: string;
  currentFrame: number;
  isPlaying: boolean;
  playSpeed: number;
}

export interface FilterState {
  boneGroups: BoneGroup[];
  dataSources: DataSource[];
  showAnomalyOnly: boolean;
  searchQuery: string;
}

export interface DataQualityReport {
  totalPoints: number;
  missingCoordinates: number;
  outlierPoints: number;
  suspiciousPoints: number;
  duplicatePoints: number;
  warnings: string[];
}

export type ActionType = 'add_note' | 'update_coordinates' | 'toggle_anomaly' | 'import_data' | 'supplement_import' | 'create_snapshot' | 'restore_snapshot' | 'update_filter' | 'change_frame';

export interface ActionLog {
  id: string;
  actionType: ActionType;
  timestamp: string;
  author: string;
  description: string;
  details?: {
    pointName?: string;
    pointId?: string;
    frameNumber?: number;
    previousValue?: any;
    newValue?: any;
    reason?: string;
    snapshotName?: string;
    importSessionId?: string;
    fileName?: string;
    changedPointCount?: number;
    diffs?: SupplementDiff[];
  };
}

export interface ImportSession {
  id: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  mode: 'initial' | 'supplement';
  totalPoints: number;
  frameCount: number;
  warnings: string[];
}

export interface ImportRecord {
  sessionId: string;
  fileName: string;
  importedAt: string;
  mode: 'initial' | 'supplement';
  sourceRow?: number;
  coordinateDiff?: CoordinateDiff;
  anomalyDiff?: AnomalyStatusDiff;
  noteDiff?: {
    previousCount: number;
    currentCount: number;
    addedNotes: string[];
  };
}

export interface SupplementDiff {
  pointName: string;
  frameNumber: number;
  previousCoordinates: { x: number; y: number; z: number };
  newCoordinates: { x: number; y: number; z: number };
  coordinateDistance: number;
  previousAnomaly: boolean;
  newAnomaly: boolean;
  previousAnomalyType?: AnomalyType;
  newAnomalyType?: AnomalyType;
  previousSource?: DataSource;
  newSource?: DataSource;
  previousSourceFile?: string;
  newSourceFile?: string;
  previousSourceRow?: number;
  newSourceRow?: number;
}

export interface ImportResult {
  frames: GaitFrame[];
  report: DataQualityReport;
  fileName: string;
  importedAt: string;
}

export interface Statistics {
  totalFrames: number;
  totalPoints: number;
  anomalyPoints: number;
  anomalyByType: Record<AnomalyType, number>;
  totalNotes: number;
  totalCoordinateChanges: number;
  pointsBySource: Record<DataSource, number>;
  pointsByBoneGroup: Record<BoneGroup, number>;
}

export const BONE_GROUP_LABELS: Record<BoneGroup, string> = {
  head: '头部',
  spine: '躯干',
  leftArm: '左臂',
  rightArm: '右臂',
  leftLeg: '左腿',
  rightLeg: '右腿',
};

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  cad_export: 'CAD导出',
  manual_edit: '手改坐标',
  photo_estimate: '照片估算',
};

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  coordinate_error: '坐标错误',
  missing_data: '数据缺失',
  outlier: '离群值',
  suspicious: '可疑数据',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  coordinate: '坐标修改',
  anomaly_status: '异常状态',
  anomaly_type: '异常类型',
  note: '添加备注',
  source: '来源变更',
  import_overwrite: '导入覆盖',
  supplement_merge: '补录合并',
};

export const ANOMALY_TYPE_SUGGESTIONS: Record<AnomalyType, string> = {
  coordinate_error: '建议：请核对原始CAD文件第{row}行，确认坐标系是否统一，必要时重新导出数据。',
  missing_data: '建议：该点位数据缺失，请检查是否有漏采，或根据相邻帧数据进行插值补全。',
  outlier: '建议：该点位与相邻帧偏差较大，请确认是否为测量误差，或手动修正坐标值。',
  suspicious: '建议：数据格式或范围存在异常，请与现场采集人员确认数据有效性。',
};

export const SKELETON_CONNECTIONS: [string, string][] = [
  ['head_top', 'neck'],
  ['neck', 'left_shoulder'],
  ['neck', 'right_shoulder'],
  ['neck', 'spine_top'],
  ['spine_top', 'spine_mid'],
  ['spine_mid', 'spine_bottom'],
  ['spine_bottom', 'left_hip'],
  ['spine_bottom', 'right_hip'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['left_wrist', 'left_hand'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['right_wrist', 'right_hand'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['left_ankle', 'left_foot'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['right_ankle', 'right_foot'],
];

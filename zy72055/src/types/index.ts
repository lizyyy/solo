export interface InspectionRecord {
  id: string;
  sourceRow: number;
  deviceName: string;
  x: number;
  y: number;
  z: number;
  floor: string;
  anomalyType: string;
  photoUrl: string | null;
  description: string;
  deviceType: string | null;
  reportedAt: string;
  _raw: Record<string, unknown>;
}

export type AnomalyType =
  | 'coordinate_offset'
  | 'duplicate_name'
  | 'missing_photo'
  | 'cross_floor'
  | 'duplicate_record'
  | 'null_value'
  | 'boundary_record'
  | 'normal';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export type AnomalyStatus = 'pending' | 'processing' | 'completed' | 'rework';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface ProcessNote {
  id: string;
  anomalyId: string;
  content: string;
  operator: string;
  timestamp: string;
  isSupplement: boolean;
  previousContent?: string;
  statusChange?: AnomalyStatus;
}

export interface Anomaly {
  id: string;
  recordId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  reportedPosition: Position;
  actualPosition?: Position;
  offsetDistance?: number;
  isCrossFloor: boolean;
  relatedFloor?: string[];
  relatedAnomalyIds: string[];
  isDuplicate?: boolean;
  duplicateOf?: string;
  notes: ProcessNote[];
  nullField?: string;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface AnomalyState {
  status: AnomalyStatus;
  notes: ProcessNote[];
}

export interface Scheme {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  operator: string;
  cameraState: CameraState;
  anomalyStates: Record<string, AnomalyState>;
}

export interface DataCheckResult {
  coordinateOffsets: Array<{ anomaly: Anomaly; distance: number }>;
  duplicateNames: Array<{ names: string[]; anomalyIds: string[] }>;
  missingPhotos: Anomaly[];
  crossFloor: Anomaly[];
  nullValues: Array<{ recordId: string; field: string }>;
  duplicates: Array<{ anomalyIds: string[]; similarity: number }>;
  boundaryRecords: Anomaly[];
}

export const STATUS_LABELS: Record<AnomalyStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  rework: '返工',
};

export const STATUS_COLORS: Record<AnomalyStatus, string> = {
  pending: '#e63946',
  processing: '#e9c46a',
  completed: '#2a9d8f',
  rework: '#f4a261',
};

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '重名设备',
  missing_photo: '缺失照片',
  cross_floor: '跨楼层异常',
  duplicate_record: '重复记录',
  null_value: '空值字段',
  boundary_record: '边界记录',
  normal: '正常',
};

export const SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
};

export const DEFAULT_CAMERA_STATE: CameraState = {
  position: [30, 25, 30],
  target: [0, 5, 0],
  fov: 50,
};

export const BRIDGE_DIMENSIONS = {
  length: 40,
  width: 8,
  height: 15,
  pierCount: 3,
  floorHeights: [0, 8, 15],
};

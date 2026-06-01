export type DeviceType = 'camera' | 'sensor' | 'indicator';
export type DeviceStatus = 'normal' | 'warning' | 'error' | 'pending';
export type DataSource = 'field' | 'cad';
export type CoordSystem = 'A' | 'B';
export type ConflictType = 
  | 'coord_offset' 
  | 'name_duplicate' 
  | 'missing_photo' 
  | 'cross_floor' 
  | 'coord_system_mismatch' 
  | 'cad_field_mismatch';
export type Severity = 'low' | 'medium' | 'high';
export type DecisionType = 'accept' | 'reject' | 'manual_check' | 'merge';

export interface Device {
  id: string;
  name: string;
  alias?: string;
  type: DeviceType;
  floor: string;
  x: number;
  y: number;
  coordSystem: CoordSystem;
  hasPhoto: boolean;
  photoUrl?: string;
  source: DataSource;
  importTime: string;
  status: DeviceStatus;
  matchedCadId?: string;
  score?: number;
  reasons?: string[];
}

export interface CadPoint {
  id: string;
  oldName?: string;
  newName?: string;
  layer: string;
  floor: string;
  x: number;
  y: number;
  coordSystem: CoordSystem;
  exportTime: string;
}

export interface ConflictEvidence {
  source: 'device' | 'cad';
  field: string;
  value: string | number | boolean;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: Severity;
  deviceIds: string[];
  cadPointIds: string[];
  evidence: ConflictEvidence[];
  suggestion: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface Decision {
  id: string;
  deviceId?: string;
  conflictId?: string;
  type: DecisionType;
  reason: string;
  operator: string;
  timestamp: string;
  paramsSnapshot: Params;
}

export interface Params {
  distanceThreshold: number;
  coordTolerance: number;
  coordSystemHandling: 'A' | 'B' | 'separate';
}

export interface ViewState {
  currentFloor: string;
  zoom: number;
  rotation: number;
  panX: number;
  panY: number;
  selectedDeviceId: string | null;
}

export interface ProjectMeta {
  name: string;
  createdAt: string;
  updatedAt: string;
  operator: string;
}

export interface AppState {
  devices: Device[];
  cadPoints: CadPoint[];
  conflicts: Conflict[];
  decisions: Decision[];
  params: Params;
  view: ViewState;
  project: ProjectMeta;
}

export type FloorMap = Record<string, { name: string; color: string }>;

export const FLOORS: FloorMap = {
  'B1': { name: 'B1层', color: '#3B82F6' },
  'B2': { name: 'B2层', color: '#8B5CF6' },
  'B3': { name: 'B3层', color: '#EC4899' },
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  coord_offset: '坐标偏移',
  name_duplicate: '设备重名',
  missing_photo: '缺少照片',
  cross_floor: '跨楼层异常',
  coord_system_mismatch: '坐标系不一致',
  cad_field_mismatch: 'CAD字段口径不一致',
};

export const STATUS_COLORS: Record<DeviceStatus, string> = {
  normal: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  pending: '#64748B',
};

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  normal: '正常',
  warning: '待确认',
  error: '异常',
  pending: '未处理',
};

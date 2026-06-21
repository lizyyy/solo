export interface Position {
  x: number;
  y: number;
  z: number;
}

export type DeviceStatus = 'normal' | 'warning' | 'error';

export interface DeviceData {
  id: string;
  name: string;
  floor: number;
  position: Position;
  energyConsumption: number;
  status: DeviceStatus;
  photo?: string;
  lastUpdate: string;
  mergedFromId?: string;
  isDuplicate?: boolean;
  aliasNames?: string[];
}

export type AnomalyType = 
  | 'coordinate_offset' 
  | 'duplicate_name' 
  | 'same_device_different_name'
  | 'missing_photo' 
  | 'cross_floor' 
  | 'empty_value' 
  | 'boundary';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  deviceId: string;
  relatedDeviceId?: string;
  description: string;
  severity: AnomalySeverity;
  resolved: boolean;
  remark?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ParameterConfig {
  id: string;
  name: string;
  energyThreshold: {
    warning: number;
    error: number;
  };
  coordinateTolerance: number;
  sameDevicePositionTolerance: number;
  sameDeviceEnergyTolerance: number;
  createdAt: string;
  updatedAt: string;
  operator: string;
}

export type SolutionStatus = 'draft' | 'reviewing' | 'approved' | 'rework';

export type OperationType = 
  | 'anomaly_resolved'
  | 'remark_added'
  | 'device_merged'
  | 'device_renamed'
  | 'config_updated'
  | 'solution_created';

export interface OperationLog {
  id: string;
  type: OperationType;
  timestamp: string;
  operator: string;
  description: string;
  details?: Record<string, any>;
}

export interface DiffSnapshot {
  timestamp: string;
  deviceCount: number;
  anomalyCount: number;
  unresolvedAnomalyCount: number;
  resolvedAnomalyCount: number;
  anomaliesByType: Record<string, number>;
  totalEnergy: number;
  remarksCount: number;
}

export interface Solution {
  id: string;
  name: string;
  configId: string;
  devices: DeviceData[];
  anomalies: Anomaly[];
  status: SolutionStatus;
  createdAt: string;
  updatedAt: string;
  operator: string;
  remarks: string[];
  operationLogs: OperationLog[];
  snapshots: DiffSnapshot[];
  mergedDevices: Array<{ sourceId: string; targetId: string; timestamp: string }>;
}

export interface AppState {
  currentSolution: Solution | null;
  currentConfig: ParameterConfig;
  solutions: Solution[];
  selectedFloor: number | null;
  selectedDevice: DeviceData | null;
  selectedAnomalyId: string | null;
  filterConditions: {
    status?: DeviceStatus;
    floor?: number;
    anomalyType?: AnomalyType;
    showResolved?: boolean;
  };
}

export interface AppActions {
  setCurrentSolution: (solution: Solution | null) => void;
  setCurrentConfig: (config: ParameterConfig) => void;
  updateConfig: (updates: Partial<ParameterConfig>) => void;
  addSolution: (solution: Solution) => void;
  updateSolution: (id: string, updates: Partial<Solution>) => void;
  setSelectedFloor: (floor: number | null) => void;
  setSelectedDevice: (device: DeviceData | null) => void;
  setSelectedAnomalyId: (id: string | null) => void;
  setFilterConditions: (conditions: Partial<AppState['filterConditions']>) => void;
  resolveAnomaly: (anomalyId: string, remark?: string) => void;
  addRemark: (remark: string) => void;
  detectAnomalies: () => Anomaly[];
  mergeSameDevice: (sourceDeviceId: string, targetDeviceId: string, canonicalName: string) => void;
  takeSnapshot: () => DiffSnapshot | null;
  addOperationLog: (type: OperationType, description: string, details?: Record<string, any>) => void;
  exportStructuredReport: () => any;
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '同名设备',
  same_device_different_name: '异名同设备',
  missing_photo: '缺少照片',
  cross_floor: '跨楼层异常',
  empty_value: '空值字段',
  boundary: '边界值',
};

export const ANOMALY_TYPE_DESCRIPTIONS: Record<AnomalyType, string> = {
  coordinate_offset: '设备坐标与标准位置偏差超过容差范围',
  duplicate_name: '多个设备使用了相同的名称',
  same_device_different_name: '同一物理设备被记录为两个不同名称（位置接近、能耗相似）',
  missing_photo: '设备缺少现场照片',
  cross_floor: '设备Y坐标与所在楼层不匹配',
  empty_value: '设备存在必填字段为空',
  boundary: '能耗值接近警告或错误阈值边界',
};

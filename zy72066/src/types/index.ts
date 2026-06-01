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
}

export type AnomalyType = 
  | 'coordinate_offset' 
  | 'duplicate_name' 
  | 'missing_photo' 
  | 'cross_floor' 
  | 'empty_value' 
  | 'boundary';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  deviceId: string;
  description: string;
  severity: AnomalySeverity;
  resolved: boolean;
  remark?: string;
}

export interface ParameterConfig {
  id: string;
  name: string;
  energyThreshold: {
    warning: number;
    error: number;
  };
  coordinateTolerance: number;
  createdAt: string;
  updatedAt: string;
  operator: string;
}

export type SolutionStatus = 'draft' | 'reviewing' | 'approved' | 'rework';

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
}

export interface AppState {
  currentSolution: Solution | null;
  currentConfig: ParameterConfig;
  solutions: Solution[];
  selectedFloor: number | null;
  selectedDevice: DeviceData | null;
  filterConditions: {
    status?: DeviceStatus;
    floor?: number;
    anomalyType?: AnomalyType;
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
  setFilterConditions: (conditions: Partial<AppState['filterConditions']>) => void;
  resolveAnomaly: (anomalyId: string, remark?: string) => void;
  addRemark: (remark: string) => void;
  detectAnomalies: () => Anomaly[];
}

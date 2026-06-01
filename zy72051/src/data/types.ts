export type AnomalyType =
  | 'coordinate_offset'
  | 'duplicate_name'
  | 'missing_photo'
  | 'cross_floor'
  | 'needs_confirmation'
  | 'old_gis_version';

export interface Building {
  id: string;
  name: string;
  position: [number, number, number];
  dimensions: [number, number, number];
  district: string;
  floors: number;
  sunlightHours: number | null;
  hasPhoto: boolean;
  gisSource: '2020' | '2024';
  deviceNames: string[];
  crossFloors: boolean;
  coordinateOffset: [number, number] | null;
  boundaryCase: boolean;
  anomalies: AnomalyType[];
}

export interface UserMarker {
  isAnomaly: boolean;
  anomalyNote: string;
  confirmed: boolean;
}

export interface Filters {
  district: string[];
  floors: [number, number];
  sunlightHours: [number, number];
  anomalyType: string[];
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface SandboxState {
  filters: Filters;
  currentHour: number;
  selectedBuildingId: string | null;
  buildings: Building[];
  userMarkers: Record<string, UserMarker>;
  cameraState: CameraState;
  setFilters: (filters: Partial<Filters>) => void;
  setCurrentHour: (hour: number | ((prev: number) => number)) => void;
  setSelectedBuilding: (id: string | null) => void;
  toggleBuildingAnomaly: (id: string, note?: string) => void;
  confirmBuilding: (id: string) => void;
  saveCameraState: (pos: [number, number, number], target: [number, number, number]) => void;
  resetAll: () => void;
}

export interface PersistedState {
  userMarkers: Record<string, UserMarker>;
  cameraState: CameraState;
  filters: Filters;
  currentHour: number;
  lastSaved: string;
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '重名设备',
  missing_photo: '缺照片',
  cross_floor: '跨楼层异常',
  needs_confirmation: '需人工确认',
  old_gis_version: '旧GIS口径',
};

export const ANOMALY_COLORS: Record<AnomalyType, string> = {
  coordinate_offset: '#ffb347',
  duplicate_name: '#ffd93d',
  missing_photo: '#95a5a6',
  cross_floor: '#ff6b6b',
  needs_confirmation: '#ffd93d',
  old_gis_version: '#9b59b6',
};

export const DISTRICTS = ['中心商务区', '科技园区', '住宅区', '文化区', '工业区'];
export const SUNLIGHT_STANDARD = 2;

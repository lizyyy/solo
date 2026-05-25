export type RackStatus = 'normal' | 'warning' | 'critical' | 'offline';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type AirDirection = 'front-to-back' | 'back-to-front' | 'left-to-right';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Dimensions {
  width: number;
  depth: number;
  height: number;
}

export interface Sensor {
  id: string;
  type: 'temperature' | 'power' | 'humidity';
  value: number;
  online: boolean;
  lastUpdate: string;
}

export interface Alert {
  id: string;
  rackId: string;
  level: AlertLevel;
  message: string;
  timestamp: string;
  active: boolean;
}

export interface Rack {
  id: string;
  name: string;
  position: Position;
  dimensions: Dimensions;
  power: number;
  temperature: number;
  status: RackStatus;
  sensors: Sensor[];
  rowId: string;
}

export interface Row {
  id: string;
  name: string;
  position: { x: number; z: number };
  airDirection: AirDirection;
  racks: string[];
}

export interface ACUnit {
  id: string;
  name: string;
  position: { x: number; z: number };
  direction: 'north' | 'south' | 'east' | 'west';
  airflow: number;
  status: 'running' | 'standby' | 'offline';
}

export interface DataCenter {
  id: string;
  name: string;
  dimensions: Dimensions;
  rows: Row[];
  racks: Rack[];
  acUnits: ACUnit[];
}

export interface TimeSeriesData {
  timestamp: string;
  racks: {
    id: string;
    power: number;
    temperature: number;
    status: RackStatus;
  }[];
  alerts: Alert[];
}

export interface CameraView {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface AppState {
  dataCenter: DataCenter | null;
  timeSeriesData: TimeSeriesData[];
  currentTimeIndex: number;
  isPlaying: boolean;
  playSpeed: number;
  alertFilters: AlertLevel[];
  selectedRackId: string | null;
  selectedRowId: string | null;
  showHeatLayer: boolean;
  showLabels: boolean;
  showRacks: boolean;
  showAirFlow: boolean;
  cameraViews: CameraView[];
  currentCameraView: string;
  currentAlerts: Alert[];
}

export interface AppActions {
  loadSampleData: () => void;
  importData: (data: { dataCenter: DataCenter; timeSeriesData: TimeSeriesData[] }) => void;
  resetState: () => void;
  setCurrentTimeIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  toggleAlertFilter: (level: AlertLevel) => void;
  setSelectedRackId: (id: string | null) => void;
  setSelectedRowId: (id: string | null) => void;
  setShowHeatLayer: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setShowRacks: (show: boolean) => void;
  setShowAirFlow: (show: boolean) => void;
  setCurrentCameraView: (viewId: string) => void;
  getFilteredAlerts: () => Alert[];
  getFilteredRacks: () => Rack[];
  getCurrentRackData: (rackId: string) => Rack | undefined;
}

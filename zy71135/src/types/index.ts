export type CargoType = 'heavy' | 'reefer' | 'dangerous';
export type DangerLevel = 'class1' | 'class2' | 'class3' | 'class4';
export type CameraView = 'overview' | 'bow' | 'stern' | 'side';
export type AlertType = 'gravity' | 'danger' | 'power' | 'weight';
export type AlertSeverity = 'warning' | 'error';

export interface Cargo {
  id: string;
  name: string;
  type: CargoType;
  weight: number;
  size: { x: number; y: number; z: number };
  dangerLevel?: DangerLevel;
  requiresPower?: boolean;
}

export interface Bay {
  id: string;
  position: { row: number; tier: number; stack: number };
  size: { x: number; y: number; z: number };
  maxWeight: number;
  hasPower: boolean;
  occupiedBy?: string;
}

export interface LoadRecord {
  timestamp: number;
  cargoId: string;
  bayId: string;
  action: 'load' | 'unload';
}

export interface CenterOfGravity {
  x: number;
  y: number;
  z: number;
  isWarning: boolean;
  offset: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  relatedItems: string[];
}

export interface AppState {
  cargoList: Cargo[];
  bays: Bay[];
  loadHistory: LoadRecord[];
  currentStep: number;
  centerOfGravity: CenterOfGravity;
  alerts: Alert[];
  selectedCargo: string | null;
  selectedBay: string | null;
  filterType: CargoType | 'all';
  cameraView: CameraView;
  isPlaying: boolean;
}

export interface AppActions {
  setSelectedCargo: (id: string | null) => void;
  setSelectedBay: (id: string | null) => void;
  setFilterType: (type: CargoType | 'all') => void;
  setCameraView: (view: CameraView) => void;
  loadCargo: (cargoId: string, bayId: string) => void;
  unloadCargo: (bayId: string) => void;
  jumpToStep: (step: number) => void;
  togglePlay: () => void;
  resetState: () => void;
  loadSampleData: () => void;
  exportReport: () => string;
  recalculate: () => void;
}

export const BAY_SCALE = 2;
export const SHIP_CENTER = { x: 0, y: 0, z: 0 };
export const GRAVITY_WARNING_THRESHOLD = 0.15;

export interface IceRink {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
  thicknessThreshold: number;
  temperatureWarning: number;
  temperatureCritical: number;
}

export interface GridPoint {
  id: string;
  x: number;
  y: number;
}

export type SampleStatus = 'normal' | 'warning' | 'critical' | 'missing';

export interface ThicknessSample {
  gridId: string;
  timestamp: number;
  thickness: number;
  status: SampleStatus;
}

export interface TemperatureProbe {
  id: string;
  x: number;
  y: number;
  depth: number;
}

export interface TemperatureReading {
  probeId: string;
  timestamp: number;
  temperature: number;
}

export interface RepairArea {
  id: string;
  points: { x: number; y: number }[];
  startTime: number;
  endTime: number;
  retested: boolean;
}

export type EventType = 'training' | 'competition' | 'maintenance';

export interface EventPeriod {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  type: EventType;
}

export interface DataSnapshot {
  timestamp: number;
  thicknessSamples: ThicknessSample[];
  temperatureReadings: TemperatureReading[];
}

export interface IceData {
  rink: IceRink;
  gridPoints: GridPoint[];
  probes: TemperatureProbe[];
  repairAreas: RepairArea[];
  events: EventPeriod[];
  snapshots: DataSnapshot[];
}

export interface ViewPreset {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface AppState {
  data: IceData | null;
  currentTimeIndex: number;
  isPlaying: boolean;
  playSpeed: number;
  selectedGridIds: string[];
  selectionBox: SelectionBox | null;
  isSelecting: boolean;
  viewMode: 'thickness' | 'temperature';
  showHeatmap: boolean;
  showGrid: boolean;
  showProbes: boolean;
  showRepairAreas: boolean;
  showThreshold: boolean;
  hoveredPoint: string | null;
}

export interface AppActions {
  loadData: (data: IceData) => void;
  setCurrentTimeIndex: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  togglePlaying: () => void;
  setSelectedGridIds: (ids: string[]) => void;
  setSelectionBox: (box: SelectionBox | null) => void;
  setIsSelecting: (selecting: boolean) => void;
  setViewMode: (mode: 'thickness' | 'temperature') => void;
  toggleHeatmap: () => void;
  toggleGrid: () => void;
  toggleProbes: () => void;
  toggleRepairAreas: () => void;
  toggleThreshold: () => void;
  setHoveredPoint: (id: string | null) => void;
  resetState: () => void;
  nextTimeStep: () => void;
  prevTimeStep: () => void;
}

export type AppStore = AppState & AppActions;

export interface Statistics {
  avgThickness: number;
  minThickness: number;
  maxThickness: number;
  normalCount: number;
  warningCount: number;
  criticalCount: number;
  missingCount: number;
  avgTemperature: number;
  pendingRepairs: number;
}

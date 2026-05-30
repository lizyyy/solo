export type ConnectionType = 'series' | 'parallel' | 'hybrid';

export type RecordStatus = 'normal' | 'supplement' | 'withdrawn' | 'duplicate';

export type DataQuality = 'normal' | 'pending' | 'anomaly';

export type LossReason = 'shading' | 'mismatch' | 'diode' | 'other';

export interface PVModule {
  id: string;
  position: { row: number; col: number };
  ratedPower: number;
  efficiency: number;
  bypassDiode: boolean;
  diodeCount: number;
}

export interface ArrayConfig {
  rows: number;
  cols: number;
  connectionType: ConnectionType;
  seriesPerString: number;
  parallelStrings: number;
  modules: PVModule[];
}

export interface Obstacle {
  id: string;
  type: 'rectangle' | 'circle' | 'polygon';
  position: { x: number; y: number };
  size: { width: number; height: number };
  opacity: number;
}

export interface ShadowConfig {
  sunAltitude: number;
  sunAzimuth: number;
  obstacles: Obstacle[];
}

export interface ShadingResult {
  moduleId: string;
  shadingRate: number;
  affectedCells: number[];
}

export interface PowerResult {
  timestamp: number;
  moduleId: string;
  actualPower: number;
  theoreticalPower: number;
  lossRate: number;
  lossReason: LossReason;
  bypassDiodeActive: boolean;
}

export interface AnalysisRecord {
  id: string;
  batchId: string;
  timestamp: number;
  status: RecordStatus;
  quality: DataQuality;
  arrayConfig: ArrayConfig;
  shadowConfig: ShadowConfig;
  shadingResults: ShadingResult[];
  powerResults: PowerResult[];
  totalPower: number;
  totalLoss: number;
  anomalyFlags: string[];
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchInfo {
  id: string;
  name: string;
  recordCount: number;
  createdAt: string;
  status: 'draft' | 'finalized';
}

export interface Filters {
  dateRange: [string, string];
  status: RecordStatus[];
  quality: DataQuality[];
  batchId: string;
}

export type AnomalyType = 
  | 'SHADOW_TIME_ERROR'
  | 'CONNECTION_MISMATCH'
  | 'DUPLICATE_LOSS'
  | 'MISSING_FIELDS'
  | 'DUPLICATE_SUBMISSION';

export interface AnomalyInfo {
  type: AnomalyType;
  message: string;
  severity: 'warning' | 'error';
}

export type PointRecordStatus = 'normal' | 'pending_review' | 'supplemented';
export type ScenarioType = 'smooth' | 'missing_row' | 'old_calibration';
export type RecordStatus = 'imported' | 'reviewing' | 'reviewed' | 'supplemented' | 'completed';
export type StepStatus = 'pending' | 'active' | 'completed';

export interface CoordinateEntry {
  id: string;
  recordId: string;
  rowIndex: number;
  x: number;
  y: number;
  radius: number;
  isMissing: boolean;
  isSupplemented: boolean;
  supplementSource: string;
}

export interface PointRecord {
  id: string;
  pointCode: string;
  safetyRadius: number;
  photoPointCount: number;
  coordinateRowCount: number;
  status: PointRecordStatus;
  scenarioType: ScenarioType;
  recordStatus: RecordStatus;
  coordinates: CoordinateEntry[];
  createdAt: string;
}

export interface OriginSpec {
  id: string;
  originCode: string;
  originX: number;
  originY: number;
  referenceSystem: string;
  measureDate: string;
  note: string;
}

export interface HistoryLog {
  id: string;
  recordId: string;
  action: string;
  operator: string;
  timestamp: string;
  detail: string;
}

export interface ObstructionPoint {
  id: string;
  recordId: string;
  pointCode: string;
  rowIndex: number;
  distance: number;
  isObstructed: boolean;
  status: PointRecordStatus;
}

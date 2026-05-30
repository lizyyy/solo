export type DataStatus = 'normal' | 'warning' | 'danger' | 'incomplete';

export interface SpeedData {
  value: number;
  source: string;
  timestamp: string;
  confidence: number;
}

export interface RadiusData {
  value: number;
  source: string;
  timestamp: string;
  confidence: number;
  isCorrected?: boolean;
  originalValue?: number;
}

export interface TireData {
  type?: string;
  compound?: string;
  source?: string;
  timestamp?: string;
  isMissing: boolean;
}

export type HistoryType = 'correction' | 'annotation' | 'data_add' | 'issue_mark';

export interface HistoryRecord {
  id: string;
  timestamp: string;
  type: HistoryType;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  operator: string;
  reason: string;
}

export interface CornerData {
  id: string;
  cornerNumber: number;
  cornerName: string;
  position: {
    x: number;
    y: number;
  };
  speed: SpeedData;
  radius: RadiusData;
  tire: TireData;
  centripetalForce: number;
  gripThreshold: number;
  gripUtilization: number;
  status: DataStatus;
  history: HistoryRecord[];
}

export interface CornerComparison {
  cornerName: string;
  speed: number;
  radius: number;
  gripUtilization: number;
}

export interface ExportReport {
  exportTime: string;
  dataset: CornerData[];
  summary: {
    totalCorners: number;
    normalCount: number;
    warningCount: number;
    dangerCount: number;
    incompleteCount: number;
  };
  calculations: {
    maxCentripetalForce: number;
    avgGripUtilization: number;
    cornerComparisons: CornerComparison[];
  };
}

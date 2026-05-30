export interface Crack {
  id: string;
  name: string;
  coordinates: [number, number, number][];
  length: number;
  width: number;
  depth: number;
  severity: 'critical' | 'warning' | 'normal';
  status: 'active' | 'monitored' | 'repaired';
  photos: string[];
  historyRecords: HistoryRecord[];
  hasBoundaryIssue: boolean;
  boundaryType?: 'coordinate_offset' | 'duplicate' | 'incomplete_data';
  manualConfirmed?: {
    operator: string;
    timestamp: string;
    notes: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Sensor {
  id: string;
  name: string;
  type: 'seepage' | 'stress' | 'displacement';
  position: [number, number, number];
  currentValue: number;
  threshold: number;
  unit: string;
  status: 'normal' | 'warning' | 'alarm' | 'offline';
  timeSeriesData: {
    timestamp: string;
    value: number;
  }[];
  hasBreakpoint: boolean;
  breakpointRecords: {
    startTime: string;
    endTime: string | null;
    reason: string;
  }[];
  manualConfirmed?: {
    operator: string;
    timestamp: string;
    notes: string;
  };
  lastReading: string;
}

export interface StressPoint {
  id: string;
  position: [number, number, number];
  stressValue: number;
  strainValue: number;
  direction: 'x' | 'y' | 'z';
  level: 'low' | 'medium' | 'high' | 'critical';
  measuredAt: string;
}

export interface HistoryRecord {
  id: string;
  targetType: 'crack' | 'sensor' | 'stress';
  targetId: string;
  changeType: 'coordinate_correction' | 'duplicate_merge' | 'breakpoint_fix' | 'manual_confirm' | 'status_update';
  beforeValue: string;
  afterValue: string;
  reason: string;
  operator: string;
  manualConfirmed: boolean;
  createdAt: string;
}

export interface FilterState {
  timeRange: [string, string];
  dataTypes: ('crack' | 'sensor' | 'stress')[];
  severityLevel: string[];
  sensorStatus: string[];
  showBoundaryIssues: boolean;
}

export interface ViewState {
  viewMode: 'perspective' | 'orthographic';
  visibleLayers: {
    dam: boolean;
    cracks: boolean;
    sensors: boolean;
    stress: boolean;
  };
}

export interface SelectedObject {
  type: 'crack' | 'sensor' | 'stress';
  id: string;
}

export interface AppState {
  filters: FilterState;
  selectedObject: SelectedObject | null;
  view: ViewState;
  cracks: Crack[];
  sensors: Sensor[];
  stressPoints: StressPoint[];
  historyRecords: HistoryRecord[];
}

export type InspectionStatus = 'pending' | 'approved' | 'exception' | 'material_only';

export type ChangeType = 'route_early' | 'note_late' | 'cad_manual' | 'flip' | 'export';

export type PointType = 'cad' | 'route' | 'device';

export interface Point {
  id: string;
  x: number;
  y: number;
  label: string;
  type: PointType;
}

export interface CoordinateData {
  points: Point[];
  centerX: number;
  centerY: number;
  rotation: number;
}

export interface ChangeRecord {
  id: string;
  inspectionId: string;
  type: ChangeType;
  affectsConclusion: boolean;
  description: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  operator: string;
  timestamp: string;
  batchRunId?: string;
}

export interface InspectionRecord {
  id: string;
  name: string;
  parkingLot: string;
  rampNumber: string;
  status: InspectionStatus;
  coordinates: CoordinateData;
  flippedCoordinates?: CoordinateData;
  flipDeviation?: number;
  changeHistory: ChangeRecord[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface BatchChange {
  inspectionId: string;
  changeType: string;
  affectsConclusion: boolean;
  description: string;
}

export interface BatchRun {
  id: string;
  taskId: string;
  runNumber: number;
  startTime: string;
  endTime: string;
  processedCount: number;
  skippedCount: number;
  changedCount: number;
  idempotentCheckPassed: boolean;
  changes: BatchChange[];
}

export interface BatchTask {
  id: string;
  name: string;
  inspectionIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  runCount: number;
  totalChanges: number;
  conclusionChanges: number;
  materialOnlyChanges: number;
  createdAt: string;
  runs: BatchRun[];
  lastRunHashes?: Record<string, string>;
}

export interface ConsistencyIssue {
  inspectionId: string;
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ConsistencyCheckResult {
  passed: boolean;
  totalItems: number;
  issues: ConsistencyIssue[];
}

export interface ExportRecord {
  id: string;
  inspectionIds: string[];
  template: 'standard' | 'detailed';
  consistencyCheck: ConsistencyCheckResult;
  exportedAt: string;
  exportedBy: string;
  fileHash: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BatchProcessRequest {
  inspectionIds: string[];
  taskName: string;
}

export interface ExportRequest {
  inspectionIds: string[];
  template: 'standard' | 'detailed';
  performConsistencyCheck: boolean;
}

export interface AppSettings {
  routeExample: {
    enabled: boolean;
    description: string;
    coordinates: CoordinateData | null;
  };
  flipRules: {
    deviationThreshold: number;
    defaultFlipType: 'x' | 'y' | 'origin';
  };
  changeTypeDefinitions: {
    type: ChangeType;
    label: string;
    color: string;
    affectsConclusionByDefault: boolean;
  }[];
}

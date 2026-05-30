export type PipelineType = 'water' | 'electric' | 'gas';
export type PipelineStatus = 'normal' | 'warning' | 'error' | 'fixed';

export type CollisionType = 'intersect' | 'distance' | 'elevation' | 'duplicate' | 'missing';
export type CollisionSeverity = 'critical' | 'warning' | 'info';
export type WorkflowStatus = 'pending' | 'processing' | 'resolved' | 'ignored';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface PipelineSegment {
  id: string;
  pipelineId: string;
  pipelineName: string;
  type: PipelineType;
  startPoint: Point3D;
  endPoint: Point3D;
  diameter: number;
  unit: 'm' | 'mm';
  startPileNo: string;
  endPileNo: string;
  dataSource: 'survey' | 'design' | 'corrected' | 'duplicate';
  hasWarning: boolean;
  warningMessage?: string;
}

export interface CollisionPoint {
  id: string;
  type: CollisionType;
  severity: CollisionSeverity;
  segmentA: PipelineSegment;
  segmentB: PipelineSegment;
  position: Point3D;
  calculatedDistance: number;
  requiredDistance: number;
  pileNo: string;
  status: WorkflowStatus;
  createdAt: string;
  dataIssues: DataIssue[];
}

export interface DataIssue {
  type: 'unit_error' | 'duplicate' | 'missing' | 'elevation_mismatch';
  description: string;
  originalValue: any;
  correctedValue?: any;
  impact: string;
}

export interface WorkflowRecord {
  id: string;
  collisionId: string;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  handler: string;
  remark: string;
  timestamp: string;
}

export interface DetectionConfig {
  waterElectricMinDist: number;
  waterGasMinDist: number;
  electricGasMinDist: number;
  sameTypeMinDist: number;
  elevationTolerance: number;
  autoCorrectUnit: boolean;
}

export interface OperationLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  module: 'data' | 'collision' | 'workflow' | 'report' | 'ui';
  message: string;
  details?: any;
}

export interface CollisionDetectionResult {
  collisions: CollisionPoint[];
  dataIssues: DataIssue[];
  totalSegments: number;
  correctedCount: number;
  skippedCount: number;
  duration: number;
}

export interface PileMarker {
  id: string;
  no: string;
  position: Point3D;
  roadName: string;
}

export interface LayerVisibility {
  water: boolean;
  electric: boolean;
  gas: boolean;
  collision: boolean;
  pileNo: boolean;
  grid: boolean;
}

export interface CameraPreset {
  name: string;
  position: Point3D;
  target: Point3D;
}

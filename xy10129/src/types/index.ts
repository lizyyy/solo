export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface YardSlot {
  id: string;
  name: string;
  position: Vector3D;
  width: number;
  length: number;
  height: number;
  type: 'storage' | 'operation' | 'aisle';
  occupied: boolean;
  cargo?: CargoInfo;
}

export interface CargoInfo {
  id: string;
  name: string;
  weight: number;
  dimensions: Vector3D;
}

export interface ForbiddenZone {
  id: string;
  name: string;
  position: Vector3D;
  width: number;
  length: number;
  height: number;
  reason: string;
}

export interface PathWaypoint {
  id: string;
  position: Vector3D;
  type: 'start' | 'waypoint' | 'end';
  timestamp?: number;
}

export interface PathSegment {
  id: string;
  from: string;
  to: string;
  distance: number;
}

export interface PathPlan {
  id: string;
  name: string;
  createdAt: number;
  waypoints: PathWaypoint[];
  segments: PathSegment[];
  totalDistance: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  id: string;
  type: 'boundary' | 'collision' | 'forbidden';
  severity: 'error' | 'warning';
  message: string;
  position?: Vector3D;
  segmentId?: string;
  zoneId?: string;
}

export interface ValidationWarning {
  id: string;
  type: 'distance' | 'turn' | 'elevation';
  message: string;
  position?: Vector3D;
}

export interface YardConfig {
  id: string;
  name: string;
  width: number;
  length: number;
  height: number;
  slots: YardSlot[];
  forbiddenZones: ForbiddenZone[];
}

export interface SavedPlan {
  id: string;
  name: string;
  createdAt: number;
  yardConfig: YardConfig;
  pathPlan: PathPlan;
  validation: ValidationResult;
}

export interface ReportData {
  planName: string;
  generatedAt: string;
  totalDistance: number;
  waypointCount: number;
  segmentCount: number;
  coordinates: Array<{
    index: number;
    type: string;
    x: number;
    y: number;
    z: number;
  }>;
  segments: Array<{
    index: number;
    from: string;
    to: string;
    distance: number;
  }>;
  validation: {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    errors: Array<{
      type: string;
      severity: string;
      message: string;
      position?: string;
    }>;
    warnings: Array<{
      type: string;
      message: string;
    }>;
  };
  zoneAnalysis: {
    visitedZones: string[];
    forbiddenZoneViolations: string[];
    collisionZones: string[];
  };
}

export type ToolMode = 'view' | 'draw' | 'edit' | 'delete';

export interface PathAnimationState {
  isPlaying: boolean;
  currentSegment: number;
  progress: number;
  speed: number;
}

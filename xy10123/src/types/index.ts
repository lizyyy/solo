export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Position {
  x: number;
  z: number;
}

export interface Dimension {
  width: number;
  depth: number;
}

export interface Booth {
  id: string;
  name: string;
  position: Position;
  dimension: Dimension;
  rotation: number;
  color: string;
  isSelected?: boolean;
}

export interface Exit {
  id: string;
  name: string;
  position: Position;
  width: number;
}

export interface Zone {
  id: string;
  name: string;
  position: Position;
  dimension: Dimension;
  color: string;
}

export interface EvacuationPath {
  fromZone: string;
  toExit: string;
  waypoints: Position[];
  distance: number;
  isBlocked: boolean;
  blockedBy?: string;
}

export interface ValidationResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  zoneId?: string;
  boothId?: string;
  exitId?: string;
  details?: Record<string, number | string | boolean>;
}

export interface SimulationConfig {
  maxEvacuationDistance: number;
  minAisleWidth: number;
  checkBoothOverlap: boolean;
  checkExitAccessibility: boolean;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  exhibitionHall: {
    width: number;
    depth: number;
  };
  booths: Booth[];
  exits: Exit[];
  zones: Zone[];
  config: SimulationConfig;
  evacuationPaths: EvacuationPath[];
  validationResults: ValidationResult[];
}

export interface ReportData {
  projectName: string;
  generatedAt: string;
  totalBooths: number;
  totalExits: number;
  totalZones: number;
  validationSummary: {
    ok: number;
    warning: number;
    error: number;
  };
  evacuationPaths: Array<{
    zone: string;
    exit: string;
    distance: number;
    maxAllowed: number;
    status: string;
    waypoints: Position[];
  }>;
  boothDetails: Array<{
    name: string;
    position: Position;
    dimension: Dimension;
    overlaps: string[];
  }>;
  exitDetails: Array<{
    name: string;
    position: Position;
    accessibility: string;
  }>;
}

export type ToolMode = 'select' | 'move' | 'add-booth' | 'add-exit' | 'add-zone';

export interface ThreeDObjectData {
  type: 'booth' | 'exit' | 'zone';
  id: string;
}

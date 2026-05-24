export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type NodeType = 'start' | 'corner' | 'stairs' | 'end';

export interface PathNode {
  id: string;
  position: Point3D;
  type: NodeType;
  timestamp: number;
}

export interface Hydrant {
  id: string;
  position: Point3D;
  name: string;
  pressure: number;
}

export interface Staircase {
  id: string;
  startPoint: Point3D;
  endPoint: Point3D;
  floors: number;
}

export interface Wall {
  id: string;
  start: Point3D;
  end: Point3D;
  height: number;
}

export interface BuildingModel {
  id: string;
  name: string;
  floors: number;
  floorHeight: number;
  walls: Wall[];
  hydrants: Hydrant[];
  staircases: Staircase[];
  groundSize: { width: number; depth: number };
}

export interface TrainingParams {
  hoseDiameter: number;
  maxHoseLength: number;
  maxCorners: number;
  minPressure: number;
  flowRate: number;
}

export type WarningType = 'length' | 'corners' | 'pressure';
export type WarningSeverity = 'warning' | 'error';

export interface Warning {
  type: WarningType;
  severity: WarningSeverity;
  message: string;
  position?: Point3D;
}

export interface PressurePoint {
  distance: number;
  pressure: number;
  nodeType?: NodeType;
}

export interface CalculationResult {
  totalLength: number;
  cornerCount: number;
  stairCount: number;
  verticalHeight: number;
  pressureLoss: number;
  remainingPressure: number;
  initialPressure: number;
  warnings: Warning[];
  isValid: boolean;
  pressureCurve: PressurePoint[];
}

export type ViewMode = 'top' | 'firstPerson' | 'free';
export type TrainingMode = 'edit' | 'playback';

export interface SceneSettings {
  showWalls: boolean;
  showHydrants: boolean;
  showStairs: boolean;
  showGrid: boolean;
}

export interface TrainingSession {
  id: string;
  startTime: number;
  endTime: number;
  buildingId: string;
  buildingName: string;
  path: PathNode[];
  params: TrainingParams;
  result: CalculationResult;
}

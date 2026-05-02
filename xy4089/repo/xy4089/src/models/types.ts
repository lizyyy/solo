export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

export interface Truss {
  id: string;
  name: string;
  type: 'box' | 'triangular' | 'ladder';
  length: number;
  width: number;
  height: number;
  weightPerMeter: number;
  position: Vector3;
  rotation: Vector3;
  color: string;
}

export interface HoistPoint {
  id: string;
  name: string;
  position: Vector3;
  maxLoad: number;
  currentLoad: number;
  trussId?: string;
  trussLocalPosition?: Vector3;
  color: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: 'light' | 'speaker' | 'led' | 'generic';
  weight: number;
  dimensions: Vector3;
  position: Vector3;
  rotation: Vector3;
  trussId?: string;
  trussLocalPosition?: Vector3;
  color: string;
  trajectory?: TrajectoryPoint[];
}

export interface TrajectoryPoint {
  time: number;
  position: Vector3;
  speed: number;
  acceleration: number;
}

export interface StageBoundary {
  id: string;
  name: string;
  type: 'proscenium' | 'curtain' | 'wall' | 'ceiling' | 'floor' | 'custom';
  vertices: Vector3[];
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  trusses: Truss[];
  hoistPoints: HoistPoint[];
  equipment: Equipment[];
  boundaries: StageBoundary[];
  settings: ProjectSettings;
}

export interface ProjectSettings {
  gravity: number;
  safetyFactor: number;
  dynamicImpactFactorBase: number;
  maxUnbalanceRatio: number;
  coordinateSystem: {
    origin: Vector3;
    unit: 'meters' | 'feet';
  };
}

export interface HoistLoadResult {
  hoistPointId: string;
  staticLoad: number;
  dynamicLoad: number;
  maxRatedLoad: number;
  loadRatio: number;
  isOverloaded: boolean;
  isWarning: boolean;
}

export interface CenterOfGravityResult {
  position: Vector3;
  totalMass: number;
  trussCount: number;
  equipmentCount: number;
}

export interface UnbalanceResult {
  xRatio: number;
  zRatio: number;
  maxRatio: number;
  isUnbalanced: boolean;
  centerPosition: Vector3;
  idealCenter: Vector3;
}

export interface CollisionResult {
  id: string;
  type: 'equipment-boundary' | 'equipment-equipment' | 'truss-boundary';
  object1: {
    id: string;
    name: string;
    type: string;
  };
  object2: {
    id: string;
    name: string;
    type: string;
  };
  distance: number;
  clearance: number;
  isColliding: boolean;
  isNear: boolean;
  penetrationDepth: number;
}

export interface ValidationResult {
  timestamp: number;
  hoistLoads: HoistLoadResult[];
  centerOfGravity: CenterOfGravityResult;
  unbalance: UnbalanceResult;
  collisions: CollisionResult[];
  hasErrors: boolean;
  hasWarnings: boolean;
  isSafe: boolean;
}

export interface ImpactFactorResult {
  baseFactor: number;
  speedFactor: number;
  accelerationFactor: number;
  totalFactor: number;
  speed: number;
  acceleration: number;
}

export interface LoadHistoryPoint {
  time: number;
  hoistPointId: string;
  staticLoad: number;
  dynamicLoad: number;
}

export interface DynamicAnalysisResult {
  totalDuration: number;
  maxLoad: number;
  maxLoadHoistPointId: string;
  maxLoadTime: number;
  maxImpactFactor: number;
  history: LoadHistoryPoint[];
}

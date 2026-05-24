export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface VehicleParams {
  id: string;
  name: string;
  length: number;
  width: number;
  wheelbase: number;
  turningRadius: number;
  height: number;
  frontOverhang: number;
  rearOverhang: number;
}

export interface Platform {
  width: number;
  depth: number;
  height: number;
  position: Vector3;
}

export interface LoadingDock {
  id: string;
  position: Vector3;
  width: number;
  height: number;
}

export interface Obstacle {
  id: string;
  type: 'pillar' | 'wall' | 'other';
  position: Vector3;
  size: Vector3;
  color?: string;
}

export interface Boundaries {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SceneData {
  platform: Platform;
  loadingDocks: LoadingDock[];
  obstacles: Obstacle[];
  boundaries: Boundaries;
  groundSize: { width: number; depth: number };
}

export interface PathPoint {
  position: Vector3;
  rotation: number;
  timestamp: number;
}

export interface CollisionPoint {
  id: string;
  position: Vector3;
  type: 'obstacle' | 'boundary' | 'platform';
  severity: 'warning' | 'critical';
  timestamp: number;
  description: string;
}

export interface SweepArea {
  points: Vector3[];
  timestamp: number;
}

export type SimulationStatus = 'idle' | 'calculating' | 'playing' | 'paused' | 'finished';

export type CameraView = 'top' | 'side' | 'driver' | 'free' | 'follow';

export interface SimulationState {
  status: SimulationStatus;
  progress: number;
  currentPath: PathPoint[];
  collisionPoints: CollisionPoint[];
  isCollision: boolean;
  cameraView: CameraView;
  speed: number;
  sweepAreas: SweepArea[];
}

export interface Sample {
  id: string;
  name: string;
  description: string;
  category: 'normal' | 'collision' | 'empty';
  vehicle: VehicleParams;
  scene: SceneData;
  expectedResult: string;
}

export interface SimulationReport {
  id: string;
  timestamp: string;
  sampleName: string;
  vehicle: VehicleParams;
  scene: SceneData;
  result: {
    hasCollision: boolean;
    collisionCount: number;
    collisionDetails: CollisionPoint[];
    pathLength: number;
    duration: number;
  };
  summary: string;
  recommendations: string[];
}

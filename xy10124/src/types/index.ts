export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface EulerAngles {
  x: number;
  y: number;
  z: number;
}

export interface JointState {
  joint1: number;
  joint2: number;
  joint3: number;
  joint4: number;
  joint5: number;
  joint6: number;
}

export interface Pose {
  position: Vector3D;
  orientation: EulerAngles;
}

export interface TrajectoryPoint {
  timestamp: number;
  joints: JointState;
  pose: Pose;
}

export interface Trajectory {
  id: string;
  name: string;
  createdAt: number;
  points: TrajectoryPoint[];
  totalTime: number;
}

export interface Obstacle {
  id: string;
  name: string;
  type: 'forbidden' | 'warning' | 'keepout';
  geometry: {
    type: 'box' | 'sphere' | 'cylinder';
    position: Vector3D;
    size?: Vector3D;
    radius?: number;
    height?: number;
  };
  color: string;
  opacity: number;
}

export enum AnomalyType {
  COLLISION = 'collision',
  NEAR_MISS = 'near_miss',
  BOUNDARY_VIOLATION = 'boundary_violation'
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  timestamp: number;
  pointIndex: number;
  description: string;
  distance?: number;
  obstacleId?: string;
  jointStates?: JointState;
  endEffectorPos?: Vector3D;
}

export interface AnalysisResult {
  trajectoryId: string;
  analyzedAt: number;
  totalPoints: number;
  safePoints: number;
  collisionCount: number;
  nearMissCount: number;
  boundaryViolationCount: number;
  anomalies: Anomaly[];
  minDistanceToObstacles: number;
}

export interface ProjectConfig {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  obstacles: Obstacle[];
  trajectories: Trajectory[];
  workspaceBounds: {
    min: Vector3D;
    max: Vector3D;
  };
  safetyMargin: number;
}

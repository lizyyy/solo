export type StoneColor = 'red' | 'yellow';
export type RotationDirection = 'clockwise' | 'counterclockwise';
export type DataSourceType = 'raw' | 'processed';
export type ErrorSeverity = 'warning' | 'error';
export type ErrorType = 'friction_too_low' | 'rotation_reversed' | 'collision_order_wrong' | 'velocity_out_of_range';

export interface Vector2D {
  x: number;
  y: number;
}

export interface StoneParams {
  id: string;
  sourceId: string;
  color: StoneColor;
  initialVelocity: Vector2D;
  rotation: {
    direction: RotationDirection;
    speed: number;
  };
  friction: number;
  initialPosition: Vector2D;
}

export interface DataSource {
  id: string;
  name: string;
  contributor: string;
  timestamp: number;
  type: DataSourceType;
  stones: StoneParams[];
}

export interface TrajectoryPoint {
  position: Vector2D;
  velocity: Vector2D;
  timestamp: number;
}

export interface StoneTrajectory {
  stoneId: string;
  points: TrajectoryPoint[];
}

export interface CollisionEvent {
  id: string;
  stoneA: string;
  stoneB: string;
  position: Vector2D;
  timestamp: number;
  type: 'stone-stone' | 'stone-wall';
}

export interface AnalysisError {
  id: string;
  type: ErrorType;
  sourceId: string;
  stoneId?: string;
  severity: ErrorSeverity;
  message: string;
  nextStep: string;
  evidence: {
    parameterName: string;
    expectedValue: number;
    actualValue: number;
  };
}

export interface EvidenceLog {
  id: string;
  timestamp: number;
  action: string;
  reason: string;
  dataSnapshot: unknown;
}

export interface SimulationState {
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  trajectories: Map<string, TrajectoryPoint[]>;
  collisions: CollisionEvent[];
}

export const ICE_SHEET_WIDTH = 4.75;
export const ICE_SHEET_LENGTH = 44.5;
export const STONE_RADIUS = 0.145;
export const STONE_MASS = 19.1;
export const GRAVITY = 9.81;
export const MIN_FRICTION = 0.008;
export const MAX_FRICTION = 0.05;
export const MIN_VELOCITY = 0;
export const MAX_VELOCITY = 3;

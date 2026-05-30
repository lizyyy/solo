export type TrackElementType = 'straight' | 'curve-left' | 'curve-right' | 'start' | 'end';

export type MagneticDirection = 'into' | 'outof' | 'left' | 'right' | 'up' | 'down';

export type ParticleType = 'proton' | 'electron' | 'alpha';

export type FailureType = 'magnetic_direction' | 'high_energy' | 'track_broken' | 'wall_collision' | null;

export interface Vector2D {
  x: number;
  y: number;
}

export interface TrackElement {
  id: string;
  type: TrackElementType;
  x: number;
  y: number;
  rotation: number;
  sourceToolId: string;
  width: number;
  height: number;
}

export interface MagneticField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strength: number;
  direction: MagneticDirection;
  sourceToolId: string;
}

export interface ParticleConfig {
  type: ParticleType;
  name: string;
  symbol: string;
  charge: number;
  mass: number;
  initialEnergy: number;
  initialVelocity: Vector2D;
  startPosition: Vector2D;
}

export interface TrajectoryPoint {
  frame: number;
  timestamp: number;
  position: Vector2D;
  velocity: Vector2D;
  force: Vector2D;
  magneticField: {
    strength: number;
    direction: MagneticDirection;
  } | null;
  inTrack: boolean;
}

export interface SimulationResult {
  success: boolean;
  failureType: FailureType;
  failureReason: string | null;
  collisionPoint: Vector2D | null;
  totalFrames: number;
  totalTime: number;
  finalEnergy: number;
  finalPosition: Vector2D;
}

export interface GameRecord {
  id: string;
  name: string;
  timestamp: number;
  sampleSource: string | null;
  trackElements: TrackElement[];
  magneticFields: MagneticField[];
  particleConfig: ParticleConfig;
  trajectory: TrajectoryPoint[];
  result: SimulationResult;
}

export interface DiagnosisResult {
  success: boolean;
  failureType: FailureType;
  summary: string;
  formula: string;
  explanation: string;
  evidence: string[];
  suggestions: string[];
  calculations: Array<{ label: string; value: string }>;
}

export interface ToolDefinition {
  id: string;
  type: 'track' | 'magnetic' | 'particle' | 'target';
  subType: string;
  name: string;
  description: string;
  icon: string;
  defaultProps: Record<string, unknown>;
}

export interface ExportData {
  version: string;
  exportTime: number;
  record: GameRecord;
  checksum: string;
}

export interface SampleDefinition {
  id: string;
  name: string;
  description: string;
  type: 'magnetic_direction' | 'high_energy' | 'track_broken' | 'wall_collision' | 'success';
  typeLabel: string;
  category: 'error' | 'success' | 'demo';
  expectedFailure: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  learningObjective: string;
  trackElements: TrackElement[];
  magneticFields: MagneticField[];
  particleConfig: ParticleConfig;
}

export const PARTICLE_PROPERTIES: Record<ParticleType, { charge: number; mass: number; name: string; symbol: string }> = {
  proton: { charge: 1.6e-19, mass: 1.67e-27, name: '质子', symbol: 'p⁺' },
  electron: { charge: -1.6e-19, mass: 9.11e-31, name: '电子', symbol: 'e⁻' },
  alpha: { charge: 3.2e-19, mass: 6.64e-27, name: 'α粒子', symbol: 'α' },
};

export function calculateGyroradius(v: number, m: number, q: number, B: number): number {
  return (m * v) / (Math.abs(q) * B);
}

export function calculateSpeed(velocity: { x: number; y: number }): number {
  return Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
}

export function calculateSpeedFromEnergy(energy: number, mass: number): number {
  return Math.sqrt((2 * energy) / mass);
}

export const GRID_SIZE = 40;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const TRACK_WIDTH = 40;
export const PARTICLE_RADIUS = 6;
export const SIMULATION_DT = 0.000001;
export const MAX_SIMULATION_FRAMES = 10000;
export const DATA_FORMAT_VERSION = '1.0.0';

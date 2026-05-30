export interface Vector2 {
  x: number;
  y: number;
}

export interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
}

export interface Marble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail: Vector2[];
}

export interface PhysicsParams {
  gravitationalConstant: number;
  timeStep: number;
  damping: number;
  escapeThreshold: number;
}

export interface EnergyState {
  kinetic: number;
  potential: number;
  total: number;
}

export type ErrorType = 'gravity_direction' | 'velocity_overflow' | 'collision_miss';

export interface ErrorMark {
  id: string;
  type: ErrorType;
  frame: number;
  timestamp: number;
  description: string;
  data: Record<string, unknown>;
}

export interface ExperimentRecord {
  id: string;
  createdAt: number;
  updatedAt: number;

  raw: {
    initialVelocity: Vector2;
    initialPosition: Vector2;
    bodies: Body[];
    physicsParams: PhysicsParams;
    launchAngle: number;
    launchSpeed: number;
  };

  corrected: {
    physicsParams: PhysicsParams;
    notes: string;
  };

  conclusion: {
    result: 'escape' | 'collide' | 'orbit' | 'chaos' | 'timeout';
    duration: number;
    finalEnergy: EnergyState;
    collisionBodyId?: string;
    orbitPeriod?: number;
    escapeDistance?: number;
    errorMarks: ErrorMark[];
    summary: string;
  };

  noteVersions: {
    version: number;
    content: string;
    timestamp: number;
  }[];

  trajectory: {
    positions: Vector2[];
    energies: EnergyState[];
    timestamps: number[];
  };
}

export type GameStatus = 'idle' | 'ready' | 'running' | 'paused' | 'settled';

export interface GameState {
  status: GameStatus;
  bodies: Body[];
  marble: Marble;
  physicsParams: PhysicsParams;
  launchAngle: number;
  launchSpeed: number;
  energyHistory: EnergyState[];
  currentFrame: number;
  simulationTime: number;
  errorMarks: ErrorMark[];
  trajectoryBuffer: {
    positions: Vector2[];
    energies: EnergyState[];
    timestamps: number[];
  };
}

export const DEFAULT_PHYSICS_PARAMS: PhysicsParams = {
  gravitationalConstant: 500,
  timeStep: 0.016,
  damping: 0,
  escapeThreshold: 0,
};

export const DEFAULT_BODIES: Body[] = [
  { id: 'body1', x: 350, y: 180, vx: 0, vy: 0.8, mass: 1000, radius: 25, color: '#ff6b6b' },
  { id: 'body2', x: 280, y: 320, vx: -0.7, vy: -0.4, mass: 800, radius: 22, color: '#4ecdc4' },
  { id: 'body3', x: 420, y: 320, vx: 0.7, vy: -0.4, mass: 900, radius: 23, color: '#ffe66d' },
];

export const DEFAULT_MARBLE: Marble = {
  x: 100,
  y: 250,
  vx: 0,
  vy: 0,
  radius: 6,
  trail: [],
};

export const RESULT_LABELS: Record<ExperimentRecord['conclusion']['result'], string> = {
  escape: '逃逸成功',
  collide: '碰撞失败',
  orbit: '稳定环绕',
  chaos: '混沌轨道',
  timeout: '超时未决',
};

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  gravity_direction: '引力方向错误',
  velocity_overflow: '速度溢出',
  collision_miss: '碰撞漏判',
};

export const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  gravity_direction: '#ff6b35',
  velocity_overflow: '#ff4757',
  collision_miss: '#ffa502',
};

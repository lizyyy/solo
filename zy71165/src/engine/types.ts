export interface Node {
  id: string;
  x: number;
  y: number;
  type: 'source' | 'junction' | 'user';
  pressure: number;
  label?: string;
}

export interface Pipe {
  id: string;
  fromNode: string;
  toNode: string;
  diameter: number;
  hasValve: boolean;
  valveId?: string;
}

export interface Valve {
  id: string;
  pipeId: string;
  isOpen: boolean;
  isMainValve: boolean;
  position: { x: number; y: number };
}

export interface Leak {
  id: string;
  nodeId: string;
  leakRate: number;
  isIsolated: boolean;
}

export interface UserArea {
  id: string;
  nodeId: string;
  userCount: number;
  isAffected: boolean;
}

export interface Level {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description: string;
  maxSteps?: number;
  timeLimit?: number;
  baseSteps?: number;
  targetIsolatedLeaks: number;
  maxAffectedUsers: number;
  minPressure: number;
  nodes: Node[];
  pipes: Pipe[];
  valves: Valve[];
  leaks: Leak[];
  userAreas: UserArea[];
}

export interface GameState {
  nodes: Node[];
  pipes: Pipe[];
  valves: Valve[];
  leaks: Leak[];
  userAreas: UserArea[];
  affectedUsers: number;
  isolatedLeaks: number;
  averagePressure: number;
  minPressure: number;
  stepCount: number;
  elapsedTime: number;
}

export interface Operation {
  timestamp: number;
  type: 'valve_toggle';
  valveId: string;
  fromState: boolean;
  toState: boolean;
  gameStateSnapshot: GameState;
}

export type FailureType =
  | 'leak_not_isolated'
  | 'pressure_too_low'
  | 'too_many_affected'
  | 'main_valve_closed'
  | 'steps_exceeded'
  | 'time_exceeded';

export interface FailureReason {
  type: FailureType;
  message: string;
  location?: { nodeId?: string; valveId?: string };
  operationIndex?: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  leakBonus: number;
  userPenalty: number;
  pressurePenalty: number;
  stepPenalty: number;
  timeBonus: number;
}

export interface IsolationReport {
  levelId: string;
  levelName: string;
  timestamp: number;
  operations: Operation[];
  finalState: GameState;
  affectedUserAreas: string[];
  isolatedLeaks: string[];
  closedValves: string[];
  recommendations: string[];
}

export interface SettlementResult {
  success: boolean;
  score: number;
  breakdown: ScoreBreakdown;
  failureReasons: FailureReason[];
  report: IsolationReport;
}

export interface GameRecord {
  id: string;
  levelId: string;
  levelName: string;
  timestamp: number;
  success: boolean;
  score: number;
  operations: Operation[];
  settlementResult: SettlementResult;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'settled';

export const CELL_SIZE = 40;

export enum CellType {
  EMPTY = 'empty',
  WALL = 'wall',
  EXIT = 'exit',
  SMOKE_SOURCE = 'smoke_source',
  CUSTOMER = 'customer',
  SIGN = 'sign',
}

export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

export interface Position {
  x: number;
  y: number;
}

export interface Customer {
  id: string;
  position: Position;
  targetExit: Position | null;
  path: Position[];
  pathIndex: number;
  isEvacuated: boolean;
  isTrapped: boolean;
  speed: number;
  waitTime: number;
  lastDirection: Direction | null;
}

export interface SmokeCell {
  position: Position;
  density: number;
}

export interface Sign {
  id: string;
  position: Position;
  direction: Direction;
}

export interface Level {
  id: string;
  name: string;
  width: number;
  height: number;
  walls: Position[];
  exits: Position[];
  smokeSources: Position[];
  customers: Customer[];
  signs: Sign[];
  maxTimeSteps: number;
}

export interface SimulationState {
  timeStep: number;
  isRunning: boolean;
  isPaused: boolean;
  customers: Customer[];
  smokeCells: SmokeCell[];
  evacuatedCount: number;
  trappedCount: number;
  congestionEvents: CongestionEvent[];
  reverseEvents: ReverseEvent[];
  deadEndEvents: DeadEndEvent[];
  isComplete: boolean;
}

export interface CongestionEvent {
  timeStep: number;
  position: Position;
  customerIds: string[];
  severity: number;
}

export interface ReverseEvent {
  timeStep: number;
  customerId: string;
  position: Position;
  direction: Direction;
  reason: string;
}

export interface DeadEndEvent {
  timeStep: number;
  customerId: string;
  position: Position;
}

export interface ScoreResult {
  totalScore: number;
  baseScore: number;
  congestionPenalty: number;
  reversePenalty: number;
  deadEndPenalty: number;
  timeoutPenalty: number;
  reasons: string[];
}

export interface SimulationRecord {
  level: Level;
  states: SimulationState[];
  scoreResult: ScoreResult | null;
}

export type ToolType = 'select' | 'wall' | 'exit' | 'smoke' | 'customer' | 'sign' | 'eraser';

export interface GameState {
  level: Level;
  simulation: SimulationState | null;
  selectedTool: ToolType;
  selectedSignDirection: Direction;
}

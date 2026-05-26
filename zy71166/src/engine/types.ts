export type RackStatus = 'normal' | 'warning' | 'danger' | 'fault';
export type ACStatus = 'off' | 'running' | 'overload' | 'fault';
export type GamePhase = 'playing' | 'paused' | 'won' | 'lost';
export type OperationType = 'ac_toggle' | 'ac_setpoint' | 'migrate_load' | 'next_turn';
export type EventType = 'hotspot' | 'ac_overload' | 'migrate_fail' | 'load_spike' | 'cost_exceed';
export type PricePeriod = 'peak' | 'flat' | 'valley';

export interface Position {
  x: number;
  z: number;
}

export interface Rack {
  id: string;
  name: string;
  position: Position;
  load: number;
  maxLoad: number;
  temperature: number;
  status: RackStatus;
  airflow: number;
}

export interface ACUnit {
  id: string;
  name: string;
  position: Position;
  isOn: boolean;
  setPoint: number;
  capacity: number;
  efficiency: number;
  powerDraw: number;
  status: ACStatus;
}

export interface TurnState {
  turn: number;
  hour: number;
  outdoorTemp: number;
  electricityPrice: number;
  pricePeriod: PricePeriod;
  electricityUsed: number;
  totalCost: number;
  score: number;
  budget: number;
}

export interface Operation {
  id: string;
  turn: number;
  type: OperationType;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface GameEvent {
  id: string;
  turn: number;
  hour: number;
  type: EventType;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  timestamp: number;
}

export interface TurnSnapshot {
  turn: number;
  racks: Rack[];
  acUnits: ACUnit[];
  turnState: TurnState;
}

export interface GameState {
  gameId: string;
  levelId: string;
  levelName: string;
  racks: Rack[];
  acUnits: ACUnit[];
  turnState: TurnState;
  gamePhase: GamePhase;
  failReason: string | null;
  operationLog: Operation[];
  eventLog: GameEvent[];
  snapshotHistory: TurnSnapshot[];
  totalTurns: number;
  createdAt: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rackCount: number;
  acCount: number;
  totalTurns: number;
  budget: number;
  initialTemp: number;
  outdoorTempCurve: number[];
  peakHours: number[];
  valleyHours: number[];
  eventProbability: number;
  targetScore: number;
}

export interface PhysicsConfig {
  HEAT_RATE: number;
  COP_BASE: number;
  INFILTRATION_RATE: number;
  DIFFUSION_RATE: number;
  HEAT_CAPACITY: number;
  WARNING_TEMP: number;
  DANGER_TEMP: number;
  FAULT_TEMP: number;
  OVERLOAD_THRESHOLD: number;
  MIGRATE_SUCCESS_RATE: number;
}

export interface ScoreConfig {
  SURVIVAL_BONUS: number;
  TEMP_BONUS_PER_DEGREE: number;
  TEMP_BONUS_THRESHOLD: number;
  COST_PENALTY_RATE: number;
  WARNING_PENALTY: number;
  BALANCE_BONUS_MAX: number;
}

export interface ReplayRecord {
  gameId: string;
  levelId: string;
  levelName: string;
  finalScore: number;
  gamePhase: GamePhase;
  failReason: string | null;
  totalTurns: number;
  completedTurns: number;
  totalCost: number;
  snapshots: TurnSnapshot[];
  operationLog: Operation[];
  eventLog: GameEvent[];
  createdAt: number;
}

export interface RackDetail {
  rack: Rack;
  neighborRacks: Rack[];
  heatContribution: number;
  coolReceiving: number;
}

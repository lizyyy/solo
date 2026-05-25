export type StallType = 'food' | 'drink' | 'craft';

export interface Stall {
  id: string;
  name: string;
  type: StallType;
  position: { x: number; y: number };
  power: number;
  maxPower: number;
  exhaustLevel: number;
  isOn: boolean;
  smokeOutput: number;
  color: string;
  emoji: string;
}

export type GamePhase = 'menu' | 'playing' | 'paused' | 'settlement' | 'replay';

export interface Customer {
  id: string;
  x: number;
  y: number;
  targetStallId: string | null;
  speed: number;
}

export type EventType = 'warning' | 'info' | 'penalty' | 'reward';

export interface GameEvent {
  id: string;
  type: EventType;
  message: string;
  round: number;
  timestamp: number;
}

export interface HistoryFrame {
  round: number;
  timestamp: number;
  snapshot: {
    totalElectricity: number;
    totalSmoke: number;
    complaints: number;
    score: number;
    money: number;
    stalls: Array<{
      id: string;
      power: number;
      isOn: boolean;
      exhaustLevel: number;
    }>;
  };
  action: string;
}

export interface ScoreBreakdown {
  efficiency: number;
  compliance: number;
  profit: number;
  penalty: number;
  total: number;
}

export interface FailureReason {
  type: 'complaints' | 'tripping' | 'money';
  message: string;
  detail: string;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  maxRounds: number;
  roundDuration: number;
  maxElectricity: number;
  maxComplaints: number;
  maxSmoke: number;
  targetMoney: number;
  idealElectricity: number;
  stallConfigs: Array<{
    name: string;
    type: StallType;
    position: { x: number; y: number };
    maxPower: number;
    smokeCoefficient: number;
    color: string;
    emoji: string;
  }>;
  randomEvents: RandomEventConfig[];
}

export interface RandomEventConfig {
  id: string;
  name: string;
  description: string;
  probability: number;
  effect: {
    electricityDelta?: number;
    smokeDelta?: number;
    complaintDelta?: number;
    moneyDelta?: number;
    message: string;
  };
}

export interface GameReport {
  levelId: number;
  levelName: string;
  totalRounds: number;
  finalScore: number;
  scoreBreakdown: ScoreBreakdown;
  totalPenalties: number;
  totalWarnings: number;
  totalRewards: number;
  failureReason: FailureReason | null;
  stallPerformance: Array<{
    name: string;
    avgPower: number;
    totalSmoke: number;
    violations: number;
  }>;
  history: HistoryFrame[];
  timestamp: number;
}

export interface OperationError {
  type: 'invalid_power' | 'tripping' | 'smoke_violation' | 'timeout';
  stallId?: string;
  round: number;
  detail: string;
}
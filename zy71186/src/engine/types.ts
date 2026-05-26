export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended' | 'replaying';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameState {
  time: number;
  reservoirStorage: number;
  gateOpening: number;
  inflow: number;
  outflow: number;
  downstreamLevel: number;
  isOvertopping: boolean;
  isDownstreamWarning: boolean;
  isDownstreamDanger: boolean;
  isDeadStorage: boolean;
  overtoppingHours: number;
  downstreamWarningHours: number;
  downstreamDangerHours: number;
  deadStorageHours: number;
}

export interface Level {
  id: string;
  name: string;
  difficulty: Difficulty;
  description: string;
  duration: number;
  inflowCurve: number[];
  initialStorage: number;
  targetStorage: number;
  maxStorage: number;
  normalStorage: number;
  deadStorage: number;
  safeDischarge: number;
  warningDischarge: number;
  maxDischarge: number;
}

export interface ScoreResult {
  total: number;
  storageScore: number;
  downstreamScore: number;
  efficiencyScore: number;
  stabilityScore: number;
  details: {
    finalStorage: number;
    maxDownstreamDischarge: number;
    gateChanges: number;
    overflowEvents: number;
    warningEvents: number;
    dangerEvents: number;
    avgEfficiency: number;
  };
}

export interface GameRecord {
  levelId: string;
  levelName: string;
  startTime: string;
  endTime: string;
  states: GameState[];
  gateChanges: { time: number; opening: number }[];
  finalScore: ScoreResult;
  isWin: boolean;
  failureReason?: string;
}

export interface GameConfig {
  tickRate: number;
  hoursPerTick: number;
}

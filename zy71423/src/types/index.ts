export type FunctionType = 'linear' | 'quadratic' | 'piecewise' | 'trigonometric';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TrapType = 'discontinuity' | 'corner' | 'cusp' | 'verticalTangent';
export type RecordStatus = 'normal' | 'pending' | 'exception';
export type RecordType = 'normal' | 'late' | 'withdrawn' | 'duplicate';
export type ExceptionType = 'out_of_bounds' | 'slope_misjudgment' | 'breakpoint_crossing';
export type Severity = 'low' | 'medium' | 'high';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';
export type Screen = 'home' | 'game' | 'records' | 'reports';

export interface Trap {
  x: number;
  type: TrapType;
  radius: number;
}

export interface FunctionCard {
  id: string;
  name: string;
  expression: string;
  type: FunctionType;
  difficulty: Difficulty;
  domain: [number, number];
  discontinuities: number[];
  nonDifferentiablePoints: number[];
  traps: Trap[];
  description: string;
  fn: (x: number) => number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlayerState {
  position: Point;
  speed: number;
  direction: 1 | -1;
  pathIndex: number;
}

export interface GameRecord {
  id: string;
  batchId: string;
  gameId: string;
  functionCardId: string;
  timestamp: number;
  playerPosition: Point;
  slope: number;
  isDifferentiable: boolean;
  speed: number;
  status: RecordStatus;
  recordType: RecordType;
  missingFields: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExceptionRecord {
  id: string;
  recordId: string;
  batchId: string;
  type: ExceptionType;
  severity: Severity;
  description: string;
  position: Point;
  timestamp: number;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: number;
}

export interface ExceptionSummary {
  type: string;
  count: number;
  severity: string;
}

export interface BatchReport {
  id: string;
  batchId: string;
  startTime: number;
  endTime: number;
  totalRecords: number;
  normalRecords: number;
  exceptionRecords: number;
  pendingRecords: number;
  functionCards: string[];
  score: number;
  maxCombo: number;
  exceptions: ExceptionSummary[];
  generatedAt: number;
  generatedBy: string;
}

export interface CurvePoint extends Point {
  slope: number;
  isDifferentiable: boolean;
  isDiscontinuity: boolean;
  trap?: Trap;
}

export interface GameState {
  currentScreen: Screen;
  selectedFunctionCard: FunctionCard | null;
  gameStatus: GameStatus;
  player: PlayerState;
  records: GameRecord[];
  exceptions: ExceptionRecord[];
  reports: BatchReport[];
  currentBatchId: string;
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  curvePoints: CurvePoint[];
}

export type CellType = 'road' | 'building' | 'lowland' | 'drain' | 'pump' | 'empty';

export type FacilityStatus = 'normal' | 'warning' | 'danger' | 'broken';

export type RainIntensity = 'light' | 'moderate' | 'heavy' | 'storm';

export interface Facility {
  id: string;
  x: number;
  y: number;
  status: FacilityStatus;
  efficiency: number;
}

export interface Drain extends Facility {
  type: 'drain';
  capacity: number;
  blockage: number;
  inflow: number;
  collectedWater: number;
}

export interface Pump extends Facility {
  type: 'pump';
  power: number;
  maxPower: number;
  currentLoad: number;
  overloadCount: number;
  connectedDrains: string[];
  pumpedWater: number;
}

export interface Lowland extends Facility {
  type: 'lowland';
  waterLevel: number;
  maxSafeLevel: number;
  dangerCount: number;
}

export interface GridCell {
  x: number;
  y: number;
  type: CellType;
  elevation: number;
  waterDepth: number;
  facility?: Drain | Pump | Lowland;
}

export interface RainEvent {
  startTurn: number;
  duration: number;
  intensity: RainIntensity;
  affectedArea: { x: number; y: number; radius: number }[];
}

export interface GameState {
  turn: number;
  maxTurns: number;
  isPaused: boolean;
  isGameOver: boolean;
  isVictory: boolean;
  failReason?: string;
  score: number;
  speed: 1 | 2 | 4;
  grid: GridCell[][];
  facilities: (Drain | Pump | Lowland)[];
  rainEvents: RainEvent[];
  currentRain: RainEvent | null;
  forecast: RainEvent[];
  selectedCell: { x: number; y: number } | null;
  isReplayMode: boolean;
  replayTurn: number;
}

export interface HistoryRecord {
  turn: number;
  state: GameState;
  scoreDelta: number;
  events: string[];
  timestamp: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  drainMaintenance: number;
  pumpEfficiency: number;
  waterPenalty: number;
  facilityDamage: number;
  bonus: number;
}

export interface GameReport {
  finalScore: number;
  isVictory: boolean;
  failReason?: string;
  totalTurns: number;
  scoreBreakdown: ScoreBreakdown;
  keyEvents: { turn: number; event: string }[];
  facilityStats: {
    drains: { total: number; broken: number; avgEfficiency: number };
    pumps: { total: number; broken: number; avgLoad: number };
    lowlands: { total: number; maxLevel: number; dangerTurns: number };
  };
  timeline: HistoryRecord[];
}

export type FacilityType = 'drain' | 'pump' | 'lowland';

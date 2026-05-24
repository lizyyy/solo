export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type ShipType = 'cargo' | 'container' | 'tanker';
export type ShipStatus = 'approaching' | 'waiting' | 'docking' | 'docked' | 'undocking' | 'departing';
export type TugStatus = 'idle' | 'moving' | 'towing' | 'returning';
export type GamePhase = 'setup' | 'playing' | 'paused' | 'ended';
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type FailReason = 'none' | 'collision' | 'fuel_depleted' | 'tide_missed' | 'time_out';

export interface Ship {
  id: string;
  name: string;
  type: ShipType;
  position: Vector3;
  rotation: number;
  targetBerthId?: string;
  status: ShipStatus;
  requiredTugs: number;
  assignedTugIds: string[];
  draft: number;
  arrivalTime: number;
  departureTime: number;
  actualArrivalTime?: number;
  actualDepartureTime?: number;
  speed: number;
  length: number;
}

export interface Tug {
  id: string;
  name: string;
  position: Vector3;
  rotation: number;
  status: TugStatus;
  fuel: number;
  maxFuel: number;
  assignedShipId?: string;
  speed: number;
  homePosition: Vector3;
}

export interface Berth {
  id: string;
  name: string;
  position: Vector3;
  rotation: number;
  occupied: boolean;
  occupiedShipId?: string;
  maxDraft: number;
  length: number;
}

export interface Tide {
  currentLevel: number;
  minLevel: number;
  maxLevel: number;
  cycleTime: number;
  nextHighTime: number;
  nextLowTime: number;
}

export interface Score {
  onTimeCompletions: number;
  fuelEfficiency: number;
  safetyScore: number;
  penalties: number;
  total: number;
  grade: Grade;
}

export interface GameEvent {
  id: string;
  time: number;
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
}

export interface CollisionWarning {
  id: string;
  time: number;
  object1Id: string;
  object2Id: string;
  distance: number;
  severity: 'warning' | 'critical';
}

export interface HistoryFrame {
  time: number;
  ships: Ship[];
  tugs: Tug[];
  tide: Tide;
  events: string[];
}

export interface Level {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;
  duration: number;
  initialShips: Omit<Ship, 'assignedTugIds' | 'actualArrivalTime' | 'actualDepartureTime'>[];
  initialTugs: Omit<Tug, 'rotation'>[];
  berths: Berth[];
  tide: Omit<Tide, 'currentLevel'>;
  objectives: LevelObjective[];
}

export interface LevelObjective {
  id: string;
  description: string;
  type: 'dock' | 'undock' | 'safety' | 'fuel';
  targetValue: number;
  currentValue: number;
  completed: boolean;
  points: number;
}

export interface GameState {
  phase: GamePhase;
  time: number;
  timeSpeed: number;
  maxTime: number;
  levelId: string;
  score: Score;
  ships: Ship[];
  tugs: Tug[];
  berths: Berth[];
  tide: Tide;
  events: GameEvent[];
  collisionWarnings: CollisionWarning[];
  history: HistoryFrame[];
  selectedTugId?: string;
  selectedShipId?: string;
  failReason: FailReason;
  objectives: LevelObjective[];
}

export interface GameStore {
  state: GameState;
  actions: {
    startGame: (levelId: string) => void;
    pauseGame: () => void;
    resumeGame: () => void;
    resetGame: () => void;
    setTimeSpeed: (speed: number) => void;
    assignTug: (tugId: string, shipId: string) => void;
    recallTug: (tugId: string) => void;
    selectTug: (tugId?: string) => void;
    selectShip: (shipId?: string) => void;
    endGame: (reason?: FailReason) => void;
    exportReport: () => string;
    loadHistory: (history: HistoryFrame[]) => void;
    setPlaybackTime: (time: number) => void;
  };
}

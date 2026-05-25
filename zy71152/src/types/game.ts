export const SIGNAL_ASPECTS = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green'
} as const;

export type SignalAspect = typeof SIGNAL_ASPECTS[keyof typeof SIGNAL_ASPECTS];

export const TRAIN_STATUSES = {
  WAITING: 'waiting',
  RUNNING: 'running',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  DELAYED: 'delayed'
} as const;

export type TrainStatus = typeof TRAIN_STATUSES[keyof typeof TRAIN_STATUSES];

export const GAME_STATUSES = {
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
} as const;

export type GameStatus = typeof GAME_STATUSES[keyof typeof GAME_STATUSES];

export const CONFLICT_TYPES = {
  SECTION_OCCUPANCY: 'section_occupancy',
  SIGNAL_VIOLATION: 'signal_violation',
  MAINTENANCE_CONFLICT: 'maintenance_conflict',
  OVERSPEED: 'overspeed',
  TIMEOUT: 'timeout'
} as const;

export type ConflictType = typeof CONFLICT_TYPES[keyof typeof CONFLICT_TYPES];

export interface Point {
  x: number;
  y: number;
}

export interface TimeWindow {
  start: number;
  end: number;
}

export interface Section {
  id: string;
  name: string;
  from: string;
  to: string;
  fromPos: Point;
  toPos: Point;
  length: number;
  maintenance: TimeWindow[];
  bidirectional: boolean;
}

export interface Signal {
  id: string;
  sectionId: string;
  aspect: SignalAspect;
  position: Point;
  direction: 'forward' | 'backward';
}

export interface Train {
  id: string;
  name: string;
  route: string[];
  currentSectionIndex: number;
  progress: number;
  speed: number;
  maxSpeed: number;
  delay: number;
  scheduledDeparture: number;
  scheduledArrival: number;
  status: TrainStatus;
  color: string;
  direction: 'forward' | 'backward';
}

export interface GameEvent {
  time: number;
  type: string;
  message: string;
  details?: any;
}

export interface Conflict {
  type: ConflictType;
  time: number;
  message: string;
  trainIds: string[];
}

export interface Level {
  id: number;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sections: Section[];
  signals: Signal[];
  trains: Train[];
  targetScore: number;
  timeLimit: number;
  stations: { id: string; name: string; position: Point }[];
}

export interface GameState {
  time: number;
  score: number;
  status: GameStatus;
  trains: Train[];
  signals: Signal[];
  sections: Section[];
  events: GameEvent[];
  conflicts: Conflict[];
  level: Level | null;
  speedMultiplier: number;
}

export interface ReplayFrame {
  time: number;
  trains: Train[];
  signals: Signal[];
  score: number;
}

export interface ReplayData {
  levelId: number;
  finalScore: number;
  result: 'won' | 'lost';
  frames: ReplayFrame[];
  events: GameEvent[];
  timestamp: number;
}

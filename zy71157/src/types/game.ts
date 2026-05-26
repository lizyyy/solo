export type BaggageType = 'normal' | 'transfer' | 'oversize';

export type FlightStatus = 'ontime' | 'delayed' | 'cancelled';

export type BaggageStatus = 'waiting' | 'moving' | 'delivered' | 'missed' | 'error';

export type ErrorType = 'wrong_gate' | 'transfer_timeout' | 'oversize_wrong_lane' | 'flight_cancelled' | 'missed_flight';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'finished' | 'failed' | 'replay';

export type ConveyorSegment = {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  speed: number;
  isSwitch: boolean;
  switchOptions?: string[];
  currentSwitchTarget?: string;
};

export interface Baggage {
  id: string;
  type: BaggageType;
  flightNumber: string;
  targetGate: string;
  weight: number;
  isOversize: boolean;
  transferTime?: number;
  transferFlight?: string;
  status: BaggageStatus;
  position: { x: number; z: number };
  progress: number;
  currentSegmentId: string;
  path: string[];
  pathIndex: number;
  createdAt: number;
  deliveredAt?: number;
  errorType?: ErrorType;
  errorDescription?: string;
  color: string;
}

export interface Flight {
  number: string;
  gate: string;
  status: FlightStatus;
  departureTime: number;
  destination: string;
  airline: string;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  baggageSpawnRate: number;
  baggageSpeed: number;
  baggageTypes: BaggageType[];
  hasOversize: boolean;
  hasTransfer: boolean;
  hasDelays: boolean;
  passConditions: {
    minAccuracy: number;
    maxErrors: number;
    maxTransferTimeouts?: number;
    maxOversizeErrors?: number;
  };
  flights: Omit<Flight, 'status'>[];
  conveyorSegments: Omit<ConveyorSegment, 'currentSwitchTarget'>[];
  spawnPoint: { x: number; z: number };
  gates: { id: string; position: { x: number; z: number }; type: 'normal' | 'oversize' | 'storage' }[];
  switches: { id: string; position: { x: number; z: number }; options: string[] }[];
}

export interface GameEvent {
  timestamp: number;
  gameTime: number;
  type: 'baggage_spawn' | 'baggage_delivered' | 'baggage_error' | 'switch_changed' | 'flight_updated' | 'game_start' | 'game_end' | 'game_pause' | 'game_resume';
  data: any;
}

export interface BaggageError {
  baggageId: string;
  flightNumber: string;
  type: ErrorType;
  timestamp: number;
  gameTime: number;
  description: string;
  targetGate: string;
  actualGate?: string;
}

export interface GameRecord {
  id: string;
  levelId: number;
  levelName: string;
  startTime: number;
  endTime: number;
  playTime: number;
  score: number;
  correctCount: number;
  errorCount: number;
  accuracy: number;
  transferTimeoutCount: number;
  oversizeErrorCount: number;
  passed: boolean;
  events: GameEvent[];
  errors: BaggageError[];
  finalStats: {
    totalBaggage: number;
    byType: Record<BaggageType, number>;
    byGate: Record<string, number>;
  };
}

export interface GameState {
  levelId: number;
  status: GameStatus;
  timeRemaining: number;
  elapsedTime: number;
  score: number;
  correctCount: number;
  errorCount: number;
  transferTimeoutCount: number;
  oversizeErrorCount: number;
  baggages: Baggage[];
  conveyorSegments: ConveyorSegment[];
  flights: Flight[];
  gates: LevelConfig['gates'];
  switches: LevelConfig['switches'];
  events: GameEvent[];
  errors: BaggageError[];
  replayMode: boolean;
  replaySpeed: number;
  replayTime: number;
  currentLevel?: LevelConfig;
  selectedBaggageId?: string;
}

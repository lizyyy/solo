export type LogLevel = 'info' | 'warn' | 'error';

export interface Stop {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface RouteDef {
  id: string;
  name: string;
  color: string;
  stops: string[];
  altStops?: string[];
  headwayMin: number;
}

export interface Closure {
  id: string;
  fromStop: string;
  toStop: string;
  startMinute: number;
  endMinute: number;
  routeId?: string;
}

export interface PassengerEvent {
  minute: number;
  stopId: string;
  count: number;
}

export interface LevelDef {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;
  durationMin: number;
  stations: Stop[];
  routes: RouteDef[];
  initialFleet: number;
  maxComplaints: number;
  maxDelayMin: number;
  minCoverage: number;
  closures: Closure[];
  passengerEvents: PassengerEvent[];
}

export type VehicleStatus = 'idle' | 'moving' | 'stopped' | 'finished';

export interface Vehicle {
  id: string;
  routeId: string;
  stopIndex: number;
  progress: number;
  load: number;
  capacity: number;
  status: VehicleStatus;
  delayMin: number;
  useAltPath: boolean;
  nextDispatchMin: number;
  totalDelayMin: number;
  skippedStops: Set<string>;
}

export interface EventLog {
  minute: number;
  level: LogLevel;
  message: string;
}

export type Phase = 'menu' | 'ready' | 'running' | 'paused' | 'ended' | 'replay';

export type Speed = 1 | 2 | 4;

export interface Stats {
  punctuality: number;
  intervalCV: number;
  complaints: number;
  loadFactor: number;
  coverage: number;
}

export interface GameState {
  phase: Phase;
  levelId: string | null;
  level: LevelDef | null;
  currentMinute: number;
  speed: Speed;
  routes: RouteDef[];
  vehicles: Vehicle[];
  waitingPassengers: Record<string, number>;
  closures: Closure[];
  logs: EventLog[];
  stats: Stats;
  failures: string[];
  score: number;
  history: GameState[];
  historyIndex: number;
  actions: Array<{ minute: number; type: string; payload?: Record<string, unknown> }>;
}

export interface ReplayEntry {
  id: string;
  levelId: string;
  levelName: string;
  finishedAt: number;
  score: number;
  failures: string[];
  stats: Stats;
  durationMin: number;
  snapshots: GameState[];
  actions: Array<{ minute: number; type: string; payload?: Record<string, unknown> }>;
}

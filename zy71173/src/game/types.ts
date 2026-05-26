export interface Position {
  x: number;
  y: number;
}

export type CellType = 'floor' | 'wall' | 'door' | 'exhibit' | 'storage' | 'congestion' | 'humidity';

export const CellType = {
  Floor: 'floor' as CellType,
  Wall: 'wall' as CellType,
  Door: 'door' as CellType,
  Exhibit: 'exhibit' as CellType,
  Storage: 'storage' as CellType,
  Congestion: 'congestion' as CellType,
  Humidity: 'humidity' as CellType,
};

export type CardType = 'A' | 'B' | 'C';

export interface Card {
  id: CardType;
  type: CardType;
}

export interface Door {
  id: string;
  position: Position;
  requiredCard: CardType;
  isOpen: boolean;
  isAuthorized: boolean;
}

export interface HumidityZone {
  id: string;
  position: Position;
  humidity: number;
  radius: number;
}

export interface CongestionZone {
  id: string;
  position: Position;
  activeRounds: number[];
}

export interface Guard {
  id: string;
  position: Position;
  patrolPath: Position[];
  currentPathIndex: number;
  patrolIndex?: number;
  visionRange: number;
  isAlerted?: boolean;
}

export interface Exhibit {
  id: string;
  name: string;
  type: 'painting' | 'sculpture' | 'artifact';
  value: number;
  maxHumidity: number;
  startPosition: Position;
}

export interface Level {
  id: number;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  gridSize: {
    width: number;
    height: number;
  };
  width: number;
  height: number;
  map: CellType[][];
  cells: CellType[][];
  doors: Door[];
  humidityZones: HumidityZone[];
  congestionZones: CongestionZone[];
  guards: Guard[];
  exhibit: Exhibit;
  exhibits: Position[];
  storagePosition: Position;
  storage: Position;
  maxRounds: number;
  availableCards: CardType[];
  desiccantCount: number;
  humidity?: number;
  congestion?: Record<number, Record<string, boolean>>;
}

export interface PathValidationResult {
  valid: boolean;
  errors: string[];
}

export type GamePhase = 'planning' | 'executing' | 'paused' | 'completed' | 'failed';

export type EventType =
  | 'move'
  | 'door_open'
  | 'humidity'
  | 'congestion'
  | 'alert'
  | 'guard_spotted'
  | 'item_used'
  | 'timeout'
  | 'humidity_damage'
  | 'door_permission_denied'
  | 'wrong_operation'
  | 'resource_waste'
  | 'door_blocked'
  | 'success';

export type GameEventType = 'move' | 'door_open' | 'humidity' | 'congestion' | 'alert' | 'guard_spotted' | 'item_used' | 'timeout';

export interface GameEvent {
  round?: number;
  type: EventType;
  position: Position;
  description?: string;
  message?: string;
  scoreChange: number;
  data?: Record<string, unknown>;
}

export type Rating = 'S' | 'A' | 'B' | 'C' | 'D';

export interface GameRecord {
  id: string;
  timestamp: number;
  levelId: string;
  totalScore: number;
  rating: Rating;
  success: boolean;
  failReason?: string;
  events: GameEvent[];
  path: Position[];
  totalRounds: number;
}

export interface ReplayState {
  isPlaying: boolean;
  currentFrame: number;
  speed: number;
  record: GameRecord | null;
}

export interface ScoreResult {
  baseScore: number;
  timeBonus: number;
  eventScores: number;
  penalties?: {
    type: string;
    amount: number;
  }[];
  totalScore: number;
  rating: Rating;
}

export interface HumidityRiskResult {
  risk: boolean;
  humidity: number;
  damage: number;
}

export interface CongestionRiskResult {
  risk: boolean;
  congestionLevel: number;
}

export interface PermissionResult {
  allowed: boolean;
  missingCard?: CardType;
}

export interface GuardUpdateResult {
  guard: Guard;
  spotted: boolean;
}

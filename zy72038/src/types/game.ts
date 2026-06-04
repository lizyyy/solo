export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended' | 'replaying';

export type EventType = 'attack' | 'defense' | 'resource' | 'system';
export type ActionType = 'build' | 'upgrade' | 'sell' | 'pause' | 'resume';
export type TowerType = 'firewall' | 'encryption' | 'backup' | 'monitor';
export type EnemyType = 'phishing' | 'malware' | 'ransomware' | 'hack';
export type FailureReason = 'rule_understanding' | 'slow_operation' | 'mixed';
export type ValidationErrorType = 'empty_level' | 'duplicate_event' | 'out_of_bounds' | 'missing_field';

export interface Level {
  id: number;
  name: string;
  waveCount: number;
  difficulty: number;
  isEmpty?: boolean;
  remarks?: string;
}

export interface GameEvent {
  id: string;
  type: EventType;
  timestamp: number;
  description: string;
  isDuplicate?: boolean;
  remarks?: string;
}

export interface ResourceConfig {
  maxCoins: number;
  maxHealth: number;
  startCoins: number;
  startHealth: number;
  outOfBounds?: boolean;
}

export interface GameConfig {
  id: string;
  name: string;
  levels: Level[];
  events: GameEvent[];
  resources: ResourceConfig;
  remarks?: string;
  sourceData?: Record<string, unknown>;
}

export interface Tower {
  id: string;
  type: TowerType;
  position: { x: number; y: number };
  level: number;
  damage: number;
  range: number;
  cost: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  reward: number;
}

export interface ActionRecord {
  id: string;
  timestamp: number;
  type: ActionType;
  towerType?: TowerType;
  position?: { x: number; y: number };
  responseTime?: number;
  isValid?: boolean;
  remarks?: string;
}

export interface GameState {
  status: GameStatus;
  currentLevel: number;
  currentWave: number;
  health: number;
  maxHealth: number;
  coins: number;
  maxCoins: number;
  towers: Tower[];
  enemies: Enemy[];
  startTime?: number;
  pauseTime?: number;
  totalPlayTime: number;
  actions: ActionRecord[];
  events: GameEvent[];
  replaySpeed: number;
  replayTime: number;
}

export interface ValidationError {
  type: ValidationErrorType;
  field: string;
  message: string;
  scoreboardValue?: string;
  importedValue?: string;
  suggestion: string;
}

export interface Evidence {
  id: string;
  type: 'action' | 'event' | 'resource' | 'rule';
  description: string;
  timestamp: number;
  source: string;
  details?: string;
}

export interface DataConflict {
  field: string;
  scoreboardValue: string;
  importedValue: string;
  suggestion: string;
  evidence: Evidence[];
}

export interface AnalysisReport {
  isSuccess: boolean;
  finalScore: number;
  totalWaves: number;
  completedWaves: number;
  failureReason?: FailureReason;
  failureReasonDescription: string;
  evidence: Evidence[];
  conflicts: DataConflict[];
  suggestions: string[];
  totalPlayTime: number;
  avgResponseTime: number;
  ruleViolations: number;
}

export interface ImportResult {
  config: GameConfig | null;
  errors: ValidationError[];
  warnings: ValidationError[];
  conflicts: DataConflict[];
  rawData: string;
}

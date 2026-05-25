export interface Position {
  x: number;
  y: number;
}

export interface Target {
  id: string;
  position: Position;
  direction: number;
  speed: number;
  isDestroyed: boolean;
  hasEscaped: boolean;
  wasDetected: boolean;
  avoidanceMode: boolean;
  avoidanceTurns: number;
  trajectory: Position[];
}

export interface NoiseSource {
  id: string;
  position: Position;
  intensity: number;
}

export interface Echo {
  id: string;
  position: Position;
  signalStrength: number;
  isNoise: boolean;
  sourceTargetId?: string;
  scanType: 'active' | 'fan' | 'passive';
  timestamp: number;
  fadeTime: number;
}

export type ScanType = 'active' | 'fan' | 'passive' | 'attack';

export interface ScanConfig {
  type: ScanType;
  name: string;
  energyCost: number;
  cooldown: number;
  range: number;
  accuracy: number;
  description: string;
  icon: string;
}

export interface PlayerAction {
  type: ScanType | 'end_turn';
  position?: Position;
  energyUsed: number;
  timestamp: number;
  result?: 'hit' | 'miss' | 'near_miss' | 'echo';
  echoCount?: number;
}

export interface GameState {
  level: LevelConfig;
  currentTurn: number;
  energy: number;
  maxEnergy: number;
  targets: Target[];
  noiseSources: NoiseSource[];
  echoes: Echo[];
  destroyedTargets: number;
  escapedTargets: number;
  missedAttacks: number;
  civilianHits: number;
  scanCooldowns: Record<ScanType, number>;
  selectedPosition: Position | null;
  actions: PlayerAction[];
  gameStatus: 'playing' | 'paused' | 'victory' | 'defeat';
  defeatReason?: string;
  score: number;
  startTime: number;
  endTime?: number;
  turnHistory: GameState[];
}

export interface LevelConfig {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  gridSize: number;
  initialEnergy: number;
  targetCount: number;
  noiseSourceCount: number;
  standardTurns: number;
  hasCivilianTargets: boolean;
  description: string;
  scanConfigs: Record<ScanType, ScanConfig>;
}

export interface HistoryRecord {
  id: string;
  levelId: string;
  levelName: string;
  difficulty: string;
  result: 'victory' | 'defeat';
  score: number;
  turns: number;
  duration: number;
  energyRemaining: number;
  targetsDestroyed: number;
  targetsTotal: number;
  defeatReason?: string;
  timestamp: number;
  gameStateSnapshot: GameState;
}

export interface ExportReport {
  version: string;
  exportTime: number;
  gameResult: 'victory' | 'defeat';
  defeatReason?: string;
  finalScore: number;
  levelInfo: LevelConfig;
  statistics: {
    totalTurns: number;
    energyUsed: number;
    energyEfficiency: number;
    hitRate: number;
    targetsDestroyed: number;
    targetsTotal: number;
    scansPerformed: number;
    attacksPerformed: number;
    echoesDetected: number;
  };
  scoreBreakdown: {
    baseScore: number;
    targetKills: number;
    firstDetectionBonus: number;
    energyBonus: number;
    turnBonus: number;
    penalties: number;
  };
  timeline: PlayerAction[];
  finalGameState: GameState;
}

export interface AnimationState {
  scanAnimation: {
    active: boolean;
    center: Position;
    radius: number;
    maxRadius: number;
    startTime: number;
    duration: number;
    type: 'active' | 'fan' | 'passive';
  } | null;
  attackAnimation: {
    active: boolean;
    position: Position;
    startTime: number;
    duration: number;
    result: 'hit' | 'miss' | 'near_miss';
  } | null;
  explosions: Array<{
    position: Position;
    startTime: number;
    duration: number;
    radius: number;
  }>;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface ScoreResult {
  totalScore: number;
  grade: Grade;
  breakdown: {
    baseScore: number;
    targetKills: number;
    firstDetectionBonus: number;
    energyBonus: number;
    turnBonus: number;
    penalties: number;
  };
  statistics: {
    hitRate: number;
    energyEfficiency: number;
    scansPerformed: number;
    attacksPerformed: number;
  };
}

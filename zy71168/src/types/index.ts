export enum HazardCategory {
  EXPLOSIVE = 'explosive',
  FLAMMABLE = 'flammable',
  OXIDIZER = 'oxidizer',
  TOXIC = 'toxic',
  CORROSIVE = 'corrosive',
  COMPRESSED_GAS = 'compressed_gas'
}

export enum CorrosiveSubType {
  ACID = 'acid',
  ALKALI = 'alkali',
  OTHER = 'other'
}

export type ZoneType = 'normal' | 'explosion_proof' | 'refrigerated' | 'toxic';

export type HighlightType = 'valid' | 'invalid' | 'isolation' | null;

export type ViolationType = 'adjacency' | 'temperature' | 'isolation' | 'zone' | 'severe';

export type OperationType = 'place' | 'remove' | 'pause' | 'resume' | 'end';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'completed' | 'failed';

export interface StorageRequirements {
  minTemp: number;
  maxTemp: number;
  maxHumidity: number;
  isolationDistance: number;
}

export interface Chemical {
  id: string;
  name: string;
  formula: string;
  category: HazardCategory;
  corrosiveSubType?: CorrosiveSubType;
  icon: string;
  hazardLevel: 1 | 2 | 3 | 4 | 5;
  storageRequirements: StorageRequirements;
  specialZones?: ZoneType[];
  description: string;
}

export interface GridCell {
  row: number;
  col: number;
  chemicalId: string | null;
  zoneType: ZoneType;
  isHighlighted: boolean;
  highlightType: HighlightType;
}

export interface Violation {
  id: string;
  type: ViolationType;
  description: string;
  penalty: number;
  involvedCells: { row: number; col: number }[];
  timestamp: number;
  isContinuous: boolean;
}

export interface Operation {
  id: string;
  type: OperationType;
  data: {
    chemicalId?: string;
    from?: { row: number; col: number };
    to?: { row: number; col: number };
  };
  timestamp: number;
  scoreDelta: number;
  violations: Violation[];
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;
  timeLimit: number;
  baseScore: number;
  chemicalIds: string[];
  environment: {
    initialTemperature: number;
    initialHumidity: number;
    temperatureFluctuation: boolean;
  };
  zones: {
    row: number;
    col: number;
    type: ZoneType;
  }[];
  targetScore: number;
}

export interface GameState {
  levelId: number | null;
  status: GameStatus;
  score: number;
  timeRemaining: number;
  grid: GridCell[][];
  temperature: number;
  humidity: number;
  placedChemicals: string[];
  pendingChemicals: string[];
  violations: Violation[];
  operationHistory: Operation[];
  isPaused: boolean;
  failureReason: string | null;
  replayIndex: number;
  isReplaying: boolean;
}

export interface ScoreDetail {
  baseScore: number;
  placementScore: number;
  isolationBonus: number;
  temperatureBonus: number;
  timeBonus: number;
  adjacencyPenalty: number;
  temperaturePenalty: number;
  isolationPenalty: number;
  zonePenalty: number;
  timePenalty: number;
  totalScore: number;
}

export interface AdjacencyRule {
  category1: HazardCategory | CorrosiveSubType;
  category2: HazardCategory | CorrosiveSubType;
  severity: 'allowed' | 'warning' | 'severe';
  penalty: number;
  description: string;
}

export const GRID_ROWS = 4;
export const GRID_COLS = 6;

export const HAZARD_CATEGORY_LABELS: Record<HazardCategory, string> = {
  [HazardCategory.EXPLOSIVE]: '爆炸品',
  [HazardCategory.FLAMMABLE]: '易燃液体',
  [HazardCategory.OXIDIZER]: '氧化剂',
  [HazardCategory.TOXIC]: '毒害品',
  [HazardCategory.CORROSIVE]: '腐蚀品',
  [HazardCategory.COMPRESSED_GAS]: '压缩气体'
};

export const HAZARD_CATEGORY_ICONS: Record<HazardCategory, string> = {
  [HazardCategory.EXPLOSIVE]: '💥',
  [HazardCategory.FLAMMABLE]: '🔥',
  [HazardCategory.OXIDIZER]: '⚡',
  [HazardCategory.TOXIC]: '☠️',
  [HazardCategory.CORROSIVE]: '🧪',
  [HazardCategory.COMPRESSED_GAS]: '💨'
};

export const HAZARD_CATEGORY_COLORS: Record<HazardCategory, string> = {
  [HazardCategory.EXPLOSIVE]: '#e94560',
  [HazardCategory.FLAMMABLE]: '#f97316',
  [HazardCategory.OXIDIZER]: '#eab308',
  [HazardCategory.TOXIC]: '#a855f7',
  [HazardCategory.CORROSIVE]: '#3b82f6',
  [HazardCategory.COMPRESSED_GAS]: '#22c55e'
};

export const ZONE_LABELS: Record<ZoneType, string> = {
  normal: '普通区',
  explosion_proof: '防爆柜',
  refrigerated: '冷藏区',
  toxic: '毒害区'
};

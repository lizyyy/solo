export type WasteCategory = 'recyclable' | 'hazardous' | 'kitchen' | 'other';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';

export type ErrorType = 'misclassified' | 'missed' | 'danger_missed';

export interface WasteItem {
  id: string;
  name: string;
  emoji: string;
  category: WasteCategory;
  isPolluted: boolean;
  isDangerous: boolean;
  points: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  speed: number;
  spawnRate: number;
  itemCount: number;
  itemTypes: WasteCategory[];
  pollutionRate: number;
  dangerRate: number;
  requiredAccuracy: number;
}

export interface GameItem extends WasteItem {
  instanceId: string;
  x: number;
  y: number;
  isDragging: boolean;
  isSorted: boolean;
}

export interface ErrorRecord {
  id: string;
  timestamp: number;
  item: WasteItem;
  wrongCategory: WasteCategory | null;
  correctCategory: WasteCategory;
  type: ErrorType;
}

export interface GameResult {
  level: LevelConfig;
  score: number;
  accuracy: number;
  maxCombo: number;
  correctCount: number;
  wrongCount: number;
  missedCount: number;
  errors: ErrorRecord[];
  duration: number;
}

export interface GameState {
  status: GameStatus;
  currentLevel: LevelConfig | null;
  score: number;
  combo: number;
  maxCombo: number;
  correctCount: number;
  wrongCount: number;
  missedCount: number;
  items: GameItem[];
  errors: ErrorRecord[];
  spawnedCount: number;
  startTime: number | null;
}

export interface CategoryBin {
  category: WasteCategory;
  name: string;
  color: string;
  bgColor: string;
  emoji: string;
}

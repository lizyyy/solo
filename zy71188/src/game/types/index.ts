export type GameStatus = 'idle' | 'playing' | 'paused' | 'finished' | 'replaying';

export type HazardType = 
  | 'blocked_path' 
  | 'expired_extinguisher' 
  | 'illegal_charging' 
  | 'normal_extinguisher'
  | 'normal_charging'
  | 'empty_path';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  speed: number;
}

export interface Hazard {
  id: string;
  type: HazardType;
  x: number;
  y: number;
  width: number;
  height: number;
  isHazard: boolean;
  description: string;
  detected: boolean;
  marked: boolean;
  markCorrect?: boolean;
}

export interface Shelf {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapTile {
  x: number;
  y: number;
  type: 'floor' | 'wall' | 'exit' | 'fire_exit';
}

export interface GameMap {
  width: number;
  height: number;
  tileSize: number;
  tiles: MapTile[];
  shelves: Shelf[];
}

export interface MarkRecord {
  hazardId: string;
  timestamp: number;
  isCorrect: boolean;
  position: Position;
}

export interface ReplayFrame {
  timestamp: number;
  player: Player;
  markedHazards: MarkRecord[];
}

export interface ScoreBreakdown {
  baseScore: number;
  correctMarks: number;
  wrongMarks: number;
  timeBonus: number;
  missedHazards: number;
  totalScore: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: Difficulty;
  timeLimit: number;
  mapSize: { width: number; height: number };
  hazardCount: number;
  normalItemCount: number;
  shelfCount: number;
  description: string;
}

export interface InspectionReport {
  levelId: number;
  levelName: string;
  timestamp: number;
  duration: number;
  totalHazards: number;
  foundHazards: number;
  missedHazards: number;
  wrongMarks: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  findings: {
    type: HazardType;
    description: string;
    found: boolean;
  }[];
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface GameState {
  status: GameStatus;
  currentLevel: number;
  timeRemaining: number;
  totalTime: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  player: Player;
  map: GameMap;
  hazards: Hazard[];
  markedRecords: MarkRecord[];
  replayData: ReplayFrame[];
  nearHazard: Hazard | null;
}

export interface ScoreRule {
  baseScore: number;
  correctMark: number;
  wrongMark: number;
  timeBonusPerSecond: number;
  missedHazard: number;
  duplicateMark: number;
}

export type ToolType = 'inspect' | 'unclog' | 'pump' | 'reinforce';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'result' | 'replay';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Position {
  x: number;
  y: number;
}

export interface Drain {
  id: string;
  position: Position;
  isBlocked: boolean;
  blockageSeverity: number;
  flowRate: number;
  inspected: boolean;
  resolved: boolean;
}

export interface LowArea {
  id: string;
  position: Position & { radius: number };
  waterLevel: number;
  maxCapacity: number;
  inspected: boolean;
  pumped: boolean;
}

export interface Obstacle {
  id: string;
  position: Position;
  type: 'vent' | 'ac' | 'pipe';
  width: number;
  height: number;
}

export interface RoofMap {
  width: number;
  height: number;
  drains: Drain[];
  lowAreas: LowArea[];
  obstacles: Obstacle[];
}

export interface LeakPoint {
  id: string;
  position: Position;
  severity: number;
  cause: 'blocked_drain' | 'overflow_lowarea' | 'unknown';
  sourceId?: string;
  roundDetected: number;
}

export interface ScoreBreakdown {
  inspectionScore: number;
  resolutionScore: number;
  efficiencyScore: number;
  timeBonus: number;
  leakPenalty: number;
  total: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: Difficulty;
  roofSize: { width: number; height: number };
  drainCount: number;
  lowAreaCount: number;
  obstacleCount: number;
  initialBlockageChance: number;
  totalRounds: number;
  maxActionPoints: number;
  rainfallPattern: number[];
  description: string;
}

export interface ToolConfig {
  cost: number;
  name: string;
  icon: string;
  description: string;
  shortcut: string;
}

export interface GameAction {
  timestamp: number;
  round: number;
  type: 'tool_use' | 'round_end' | 'rainfall_change' | 'game_start' | 'game_end';
  payload: {
    tool?: ToolType;
    targetId?: string;
    targetType?: 'drain' | 'lowarea';
    rainfallIntensity?: number;
    success?: boolean;
    message?: string;
  };
  stateSnapshot: {
    actionPoints: number;
    score: number;
    inspectedDrains: string[];
    resolvedIssues: string[];
    waterLevels: Record<string, number>;
    blockages: Record<string, number>;
  };
}

export interface GameState {
  phase: GamePhase;
  levelId: number;
  currentRound: number;
  totalRounds: number;
  actionPoints: number;
  maxActionPoints: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  rainfallIntensity: number;
  rainfallPattern: number[];
  roofMap: RoofMap;
  selectedTool: ToolType;
  inspectedDrains: string[];
  resolvedIssues: string[];
  failed: boolean;
  failureReason?: string;
  leakPoints: LeakPoint[];
  actions: GameAction[];
  isPaused: boolean;
  isReplayMode: boolean;
  replaySpeed: number;
  currentReplayIndex: number;
}

export interface GameRecord {
  id: string;
  levelId: number;
  levelName: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  totalRounds: number;
  completedRounds: number;
  failed: boolean;
  failureReason?: string;
  leakCount: number;
  timestamp: number;
  actions: GameAction[];
}

export interface InspectionReportItem {
  id: string;
  type: 'drain' | 'lowarea';
  position: Position;
  status: 'normal' | 'blocked' | 'flooded' | 'resolved';
  description: string;
  recommendation: string;
}

export interface InspectionReport {
  levelName: string;
  inspectorName: string;
  date: string;
  totalDrains: number;
  inspectedDrains: number;
  totalLowAreas: number;
  inspectedLowAreas: number;
  issuesFound: number;
  issuesResolved: number;
  leakPoints: LeakPoint[];
  items: InspectionReportItem[];
  recommendations: string[];
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

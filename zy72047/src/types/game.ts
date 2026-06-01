export type OperationType = 'drag' | 'click';
export type OperationSource = '黑胶节拍修复赛' | '课堂计分表' | '手动修正';
export type RoundStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type ConflictStatus = 'pending' | 'resolved';
export type ConflictResolution = 'classroom' | 'imported' | 'pending';

export interface Effect {
  resource: number;
  score: number;
  risk: number;
}

export interface LevelRules {
  dragEffects: Record<string, Effect>;
  clickEffects: Record<string, Effect>;
  negativeResourceBlocked: boolean;
  riskThreshold: number;
  maxOperations?: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  initialResources: number;
  targetScore: number;
  riskThreshold: number;
  rules: LevelRules;
  source: string;
  createdAt: string;
  createdBy: string;
  vinylElements: VinylElement[];
}

export interface VinylElement {
  id: string;
  label: string;
  type: 'drag' | 'click' | 'both';
  position: { x: number; y: number };
  color: string;
}

export interface GameRound {
  id: string;
  levelId: string;
  levelName: string;
  playerName: string;
  initialResources: number;
  targetScore: number;
  finalScore: number;
  finalResources: number;
  finalRisk: number;
  status: RoundStatus;
  startTime: string;
  endTime?: string;
  operator: string;
  source: string;
  pausedAt?: string;
  resumedAt?: string;
}

export interface JudgementTrace {
  rulesApplied: string[];
  decision: string;
  timestamp: string;
  module: string;
}

export interface Operation {
  id: string;
  roundId: string;
  type: OperationType;
  element: string;
  elementLabel: string;
  resourceDelta: number;
  scoreDelta: number;
  riskDelta: number;
  resourcesAfter: number;
  scoreAfter: number;
  riskAfter: number;
  timestamp: string;
  source: OperationSource;
  note: string;
  operator: string;
  isJudgementCall?: boolean;
  judgementReason?: string;
  judgementTrace?: JudgementTrace;
  position?: { x: number; y: number };
}

export interface ScoreNote {
  id: string;
  roundId: string;
  content: string;
  source: string;
  timestamp: string;
  author: string;
}

export interface Conflict {
  id: string;
  roundId: string;
  operationId?: string;
  field: string;
  classroomData: {
    value: number | string;
    note: string;
    source: string;
    timestamp: string;
  };
  importedData: {
    value: number | string;
    note: string;
    source: string;
    timestamp: string;
  };
  status: ConflictStatus;
  resolution: ConflictResolution;
  resolvedBy?: string;
  resolvedAt?: string;
  suggestedAction: string;
  suggestedReason: string;
}

export interface GameState {
  currentRound: GameRound | null;
  resources: number;
  score: number;
  risk: number;
  operations: Operation[];
  isPaused: boolean;
  currentLevel: LevelConfig | null;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  warning?: string;
}

export interface NumberChange {
  delta: number;
  newValue: number;
  timestamp: string;
}

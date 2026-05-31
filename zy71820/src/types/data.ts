import type { GameState, LevelConfig } from './game';

export type { LevelConfig };
export type ScoreStatus = 'normal' | 'pending' | 'corrected' | 'rejected';
export type AnomalyType = 'score_cheat' | 'disconnect' | 'other';
export type SourceType = 'level_draft' | 'player_feedback';
export type OperationType = 'import' | 'review' | 'correct' | 'export';
export type TargetType = 'level' | 'score';
export type ScoreSource = 'local' | 'import';

export interface AnomalyDetail {
  sourceType: SourceType;
  contact: string;
  description: string;
  detectedAt: number;
  confidence: number;
}

export interface PlayerScore {
  id: string;
  playerName: string;
  levelId: string;
  score: number;
  satisfaction: number;
  gameData: GameState;
  source: ScoreSource;
  status: ScoreStatus;
  anomalyType?: AnomalyType;
  anomalyDetail?: AnomalyDetail;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OperationHistory {
  id: string;
  operator: string;
  operationType: OperationType;
  targetType: TargetType;
  targetId: string;
  beforeData: unknown;
  afterData: unknown;
  reason: string;
  createdAt: number;
}

export interface DataVersion {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  snapshot: unknown;
  createdAt: number;
}

export interface ViewState {
  id: string;
  page: string;
  filters: {
    timeRange?: [number, number];
    levelId?: string;
    playerName?: string;
    status?: string[];
  };
  viewport: {
    scrollTop?: number;
    scrollLeft?: number;
    selectedColumns?: string[];
  };
  createdAt?: number;
  updatedAt?: number;
}

export interface ErrorMessage {
  code: string;
  message: string;
  suggestion: string;
  contact?: string;
}

export interface ExportReport {
  generatedAt: number;
  filters: ViewState['filters'];
  summary: {
    totalRecords: number;
    avgScore: number;
    maxScore: number;
    anomalyCount: number;
    pendingReviewCount: number;
  };
  records: PlayerScore[];
  exportMetadata: {
    exportedBy: string;
    viewportSnapshot: ViewState['viewport'];
  };
}

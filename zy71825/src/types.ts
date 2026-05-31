export interface LevelData {
  id: string;
  name: string;
  chapter: number;
  stage: number;
  expectedReward: string;
  rewardAmount: number;
  source: 'imported' | 'manual';
  importedAt?: number;
}

export interface PlayerRecord {
  id: string;
  playerId: string;
  playerName: string;
  levelId: string;
  levelName: string;
  completedAt: number;
  rewardStatus: 'pending' | 'confirmed' | 'corrected' | 'topped_up';
  actualReward?: string;
  actualAmount?: number;
  source: 'game_data' | 'player_feedback' | 'manual';
  feedbackNote?: string;
  handler?: string;
  handledAt?: number;
  correctionNote?: string;
}

export interface RecordHistory {
  id: string;
  recordId: string;
  action: 'created' | 'updated' | 'confirmed' | 'corrected' | 'topped_up';
  oldValue: Partial<PlayerRecord>;
  newValue: Partial<PlayerRecord>;
  operator: string;
  timestamp: number;
  note?: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ReviewStats {
  total: number;
  confirmed: number;
  pending: number;
  corrected: number;
  toBeSupplemented: number;
}

export interface ActivitySummary {
  activityName: string;
  startDate: number;
  endDate: number;
  stats: ReviewStats;
  handlingPolicy: string;
  breakdown: {
    confirmedRecords: PlayerRecord[];
    pendingRecords: PlayerRecord[];
    correctedRecords: PlayerRecord[];
    toBeSupplementedRecords: PlayerRecord[];
  };
}

export type DataSource = 'level_table' | 'player_feedback' | 'unknown';

export interface RecoveryInfo {
  recoverable: boolean;
  source: DataSource;
  message: string;
  nextStep: string;
  contactPerson: string;
}

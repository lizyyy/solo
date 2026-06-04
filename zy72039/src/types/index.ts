export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended' | 'playback';

export type DataFlag = 'normal' | 'empty' | 'duplicate' | 'boundary' | 'misoperation' | 'interrupted';

export type FailureReason = 'rule_misunderstanding' | 'slow_operation' | 'both' | null;

export type DataSource = 'manual' | 'import' | 'test';

export interface GameRecord {
  id: string;
  sequence: number;
  timestamp: number;
  formattedTime: string;
  source: DataSource;
  rawValue: string | number | null;
  processedValue: number | null;
  load: number;
  note: string;
  flags: DataFlag[];
  isSuccess: boolean;
  failureReason: FailureReason;
  failureDetail: string;
  processingNote: string;
  operator: string;
  responseTime: number | null;
  roundNumber: number;
}

export interface GameConfig {
  id: string;
  name: string;
  totalRounds: number;
  maxLoad: number;
  targetLoad: number;
  loadPerRound: number;
  timeLimitPerRound: number;
  boundaryThreshold: number;
  duplicateWindow: number;
  misoperationThreshold: number;
  slowOperationThreshold: number;
  ruleViolationPatterns: string[];
  createdBy: string;
  createdAt: number;
}

export interface GameState {
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  currentLoad: number;
  maxLoad: number;
  targetLoad: number;
  records: GameRecord[];
  startTime: number | null;
  pauseTime: number | null;
  totalPausedDuration: number;
  lastInputTime: number | null;
  config: GameConfig | null;
  playbackIndex: number;
  playbackSpeed: number;
  pauseNote: string;
}

export interface ExportMetadata {
  exportTime: string;
  gameName: string;
  totalRecords: number;
  validRecords: number;
  flaggedRecords: number;
  gameStartTime: string;
  gameEndTime: string;
  operator: string;
  configVersion: string;
  fieldDescriptions: Record<string, string>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type GameAction =
  | { type: 'START'; payload: { config: GameConfig } }
  | { type: 'PAUSE'; payload: { note: string } }
  | { type: 'RESUME' }
  | { type: 'INPUT'; payload: { value: string | number; note: string; source?: 'manual' | 'import' | 'test' } }
  | { type: 'RESTART' }
  | { type: 'END' }
  | { type: 'PLAYBACK_START' }
  | { type: 'PLAYBACK_NEXT' }
  | { type: 'PLAYBACK_PREV' }
  | { type: 'PLAYBACK_GOTO'; payload: { index: number } }
  | { type: 'PLAYBACK_STOP' };

export const DATA_FLAG_LABELS: Record<DataFlag, string> = {
  normal: '正常',
  empty: '空值',
  duplicate: '重复',
  boundary: '边界',
  misoperation: '误操作',
  interrupted: '中断',
};

export const FAILURE_REASON_LABELS: Record<Exclude<FailureReason, null>, string> = {
  rule_misunderstanding: '规则未理解',
  slow_operation: '操作超时',
  both: '规则+操作',
};

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  manual: '手动录入',
  import: '导入',
  test: '测试',
};

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  idle: '待机',
  playing: '进行中',
  paused: '已暂停',
  ended: '已结束',
  playback: '回放中',
};

export interface Resources {
  reserveRequirement: number;
  lendingRate: number;
  depositRate: number;
  inflation: number;
  gdpGrowth: number;
  employment: number;
}

export interface ResourceEffect {
  resource: keyof Resources;
  change: number;
  type: 'absolute' | 'percentage';
}

export interface LevelNode {
  id: string;
  label: string;
  type: 'start' | 'decision' | 'event' | 'end';
  position: { x: number; y: number };
  description?: string;
  effects?: ResourceEffect[];
}

export interface LevelPath {
  from: string;
  to: string;
  decisions: DecisionOption[];
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  resourceEffects: ResourceEffect[];
}

export interface TargetCondition {
  resource: keyof Resources;
  min?: number;
  max?: number;
  exact?: number;
  weight: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  initialResources: Resources;
  nodes: LevelNode[];
  paths: LevelPath[];
  targetConditions: TargetCondition[];
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'completed' | 'interrupted';

export interface GameStep {
  stepIndex: number;
  nodeId: string;
  decisionId?: string;
  decisionLabel?: string;
  resourcesBefore: Resources;
  resourcesAfter: Resources;
  timestamp: string;
  isSupplement?: boolean;
  supplementReason?: string;
}

export interface ScoreBreakdownItem {
  category: string;
  maxScore: number;
  earnedScore: number;
  description: string;
}

export interface ScoreResult {
  totalScore: number;
  maxScore: number;
  breakdown: ScoreBreakdownItem[];
  teacherNotes: string;
  calculatedAt: string;
}

export type ConflictType = 'resource_mismatch' | 'step_missing' | 'timeline_conflict' | 'duplicate_step' | 'null_value' | 'boundary_issue';

export interface ConflictEvidence {
  source: 'student' | 'imported' | 'system';
  description: string;
  data: any;
}

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  consequence: string;
}

export type ConflictResolution = 'use_student' | 'use_imported' | 'manual' | 'skip' | 'flag_for_review';

export interface Conflict {
  id: string;
  sessionId: string;
  type: ConflictType;
  stepIndex?: number;
  studentRecord: any;
  importedData: any;
  evidence: ConflictEvidence[];
  suggestedActions: SuggestedAction[];
  resolution?: ConflictResolution;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface PlayerStep {
  stepIndex: number;
  decision: string;
  decisionLabel?: string;
  timestamp?: string;
  notes?: string;
  resources?: Partial<Resources>;
}

export interface PlayerRecord {
  sessionId?: string;
  levelId: string;
  playerName: string;
  steps: PlayerStep[];
  teacherNotes?: string;
  importSource?: string;
}

export interface ImportedLevel {
  formatVersion: string;
  levels: Level[];
}

export interface ImportedPlayerRecord {
  formatVersion: string;
  records: PlayerRecord[];
}

export interface GameSession {
  id: string;
  levelId: string;
  levelName?: string;
  playerName: string;
  startTime: string;
  endTime?: string;
  status: GameStatus;
  currentNodeId: string;
  currentResources: Resources;
  stepHistory: GameStep[];
  scoreResult?: ScoreResult;
  conflicts: Conflict[];
  teacherNotes?: string;
  importedRecordId?: string;
  hasNegativeResources: boolean;
  negativeResourceAt?: string;
}

export interface ReplayState {
  isPlaying: boolean;
  currentStepIndex: number;
  playbackSpeed: number;
  sessionId: string | null;
  session: GameSession | null;
}

export const RESOURCE_LABELS: Record<keyof Resources, string> = {
  reserveRequirement: '准备金率',
  lendingRate: '贷款利率',
  depositRate: '存款利率',
  inflation: '通货膨胀率',
  gdpGrowth: 'GDP增长率',
  employment: '就业率',
};

export const RESOURCE_UNITS: Record<keyof Resources, string> = {
  reserveRequirement: '%',
  lendingRate: '%',
  depositRate: '%',
  inflation: '%',
  gdpGrowth: '%',
  employment: '%',
};

export const STATUS_LABELS: Record<GameStatus, string> = {
  idle: '未开始',
  playing: '进行中',
  paused: '已暂停',
  completed: '已完成',
  interrupted: '已中断',
};

export const STATUS_COLORS: Record<GameStatus, string> = {
  idle: 'bg-slate-500',
  playing: 'bg-success-500',
  paused: 'bg-warning-500',
  completed: 'bg-primary-500',
  interrupted: 'bg-danger-500',
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  resource_mismatch: '资源数据不一致',
  step_missing: '步骤缺失',
  timeline_conflict: '时间线冲突',
  duplicate_step: '重复步骤',
  null_value: '空值问题',
  boundary_issue: '边界值异常',
};

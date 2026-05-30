export interface DataSource {
  file: string;
  line: number;
  rawContent: string;
  importTimestamp: Date;
}

export interface Ship {
  id: string;
  name: string;
  length: number;
  draft: number;
  priority: 'high' | 'medium' | 'low';
  eta: Date;
  tugRequired: number;
  status: 'waiting' | 'berthing' | 'docked' | 'departed' | 'missed';
  source: DataSource;
}

export interface Berth {
  id: string;
  name: string;
  maxLength: number;
  maxDraft: number;
  status: 'available' | 'occupied' | 'maintenance' | 'locked';
  occupiedUntil: Date | null;
  currentShipId: string | null;
  source: DataSource;
}

export interface Tug {
  id: string;
  name: string;
  power: number;
  fuelLevel: number;
  maxFuel: number;
  availableFrom: Date;
  currentAssignment: string | null;
  status: 'available' | 'assigned' | 'operating' | 'refueling';
  source: DataSource;
}

export interface Weather {
  id: string;
  timestamp: Date;
  windLevel: number;
  waveHeight: number;
  windowType: 'operable' | 'warning' | 'restricted';
  source: DataSource;
}

export interface Schedule {
  id: string;
  shipId: string;
  berthId: string;
  tugIds: string[];
  plannedTime: Date;
  windowStart: Date;
  windowEnd: Date;
  actualTime: Date | null;
  estimatedDuration: number;
  status: 'planned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  decisionNote: string;
  createdAt: Date;
  lockedResources: {
    berth: { start: Date; end: Date };
    tugs: Array<{ tugId: string; start: Date; end: Date }>;
  };
}

export type EventType =
  | 'window_missed'
  | 'tug_conflict'
  | 'fuel_insufficient'
  | 'berthing_success'
  | 'resource_locked'
  | 'weather_changed'
  | 'schedule_created'
  | 'schedule_cancelled'
  | 'game_start'
  | 'game_end';

export const EVENT_PRIORITY: Record<EventType, number> = {
  window_missed: 1,
  tug_conflict: 2,
  fuel_insufficient: 3,
  berthing_success: 4,
  resource_locked: 5,
  weather_changed: 6,
  schedule_created: 7,
  schedule_cancelled: 8,
  game_start: 9,
  game_end: 10,
};

export const EVENT_LABELS: Record<EventType, string> = {
  window_missed: '错过靠泊窗口',
  tug_conflict: '拖轮资源冲突',
  fuel_insufficient: '燃油不足',
  berthing_success: '靠泊成功',
  resource_locked: '资源已锁定',
  weather_changed: '天气变化',
  schedule_created: '调度计划已创建',
  schedule_cancelled: '调度计划已取消',
  game_start: '游戏开始',
  game_end: '游戏结束',
};

export interface GameEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  scheduleId: string | null;
  shipId: string | null;
  tugId: string | null;
  description: string;
  rawData: Record<string, unknown>;
  priority: number;
  resolved: boolean;
  resolutionNote?: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  operator: string;
  beforeState: GameState | null;
  afterState: GameState | null;
  reason: string;
  source: DataSource | null;
}

export interface GameState {
  gameId: string;
  currentTime: Date;
  startTime: Date;
  endTime: Date;
  ships: Ship[];
  berths: Berth[];
  tugs: Tug[];
  weatherForecast: Weather[];
  schedules: Schedule[];
  events: GameEvent[];
  auditLogs: AuditLog[];
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  speed: number;
  selectedShipId: string | null;
  selectedBerthId: string | null;
  selectedTugIds: string[];
}

export interface TimelineSnapshot {
  timestamp: Date;
  state: GameState;
  events: GameEvent[];
}

export interface ExportData {
  gameId: string;
  exportedAt: Date;
  finalState: GameState;
  timelineSnapshots: TimelineSnapshot[];
  dataSources: Record<string, DataSource[]>;
  analysisReport: {
    missedWindows: GameEvent[];
    tugConflicts: GameEvent[];
    fuelIssues: GameEvent[];
    successfulBertthings: GameEvent[];
    decisionChain: Array<{
      time: Date;
      action: string;
      impact: string;
      alternatives: string[];
      reasoning: string;
    }>;
    finalScore: number;
    efficiencyMetrics: {
      onTimeRate: number;
      resourceUtilization: number;
      averageWaitTime: number;
    };
  };
}

export interface ImportError {
  file: string;
  line: number;
  rawContent: string;
  errorType: 'missing_field' | 'invalid_value' | 'conflict' | 'format_error' | 'out_of_range';
  message: string;
  suggestion: string;
}

export interface ImportResult<T> {
  data: T[];
  errors: ImportError[];
  successCount: number;
  errorCount: number;
}

export interface ScheduleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  impactedSchedules: string[];
  resourceConflicts: Array<{
    type: 'berth' | 'tug';
    resourceId: string;
    conflictingScheduleId: string;
    timeOverlap: { start: Date; end: Date };
  }>;
  windowIssues: Array<{
    type: 'outside_window' | 'window_too_short' | 'window_expired';
    message: string;
  }>;
}

export interface DecisionImpact {
  affectedResources: Array<{
    type: 'berth' | 'tug';
    id: string;
    lockPeriod: { start: Date; end: Date };
  }>;
  affectedShips: string[];
  delayRisk: number;
  windowMissRisk: number;
  fuelConsumption: number;
  scoreImpact: number;
  alternativeOptions: Array<{
    description: string;
    scoreDelta: number;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
}

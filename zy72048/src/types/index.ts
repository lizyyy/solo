export interface EventConfig {
  id: string;
  type: string;
  trigger: string;
  action: string;
}

export interface LevelConfig {
  id: string;
  name: string;
  requiredScore: number;
  resourceBounds: { min: number; max: number };
  events: EventConfig[];
}

export interface StudentRecord {
  id: string;
  source: "三角函数攀岩馆" | "学生练习记录" | "旧口径";
  levelId: string;
  score: number | null;
  resourceValue: number | null;
  rawNote: string;
  timestamp: string;
}

export type RecordStatus = "顺利" | "待人工确认" | "旧口径补录";

export interface CheckStep {
  label: string;
  passed: boolean;
  detail: string;
}

export interface JudgementResult {
  recordId: string;
  originalRecord: StudentRecord;
  status: RecordStatus;
  reason: string;
  suggestion: string;
  source: string;
  processedAt: string;
  roundNumber: number;
  checkSteps: CheckStep[];
}

export type RunStatus = "idle" | "running" | "paused" | "settled";

export interface RunState {
  status: RunStatus;
  currentRound: number;
  totalRounds: number;
  results: JudgementResult[];
  configErrors: string[];
}

export interface SettlementSummary {
  smoothCount: number;
  confirmCount: number;
  oldCaliberCount: number;
  totalRecords: number;
  settledAt: string;
  runDurationMs: number;
}

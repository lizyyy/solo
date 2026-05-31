export interface Unit {
  id: string;
  name: string;
  faction: 'steam' | 'gear' | 'clockwork';
  speed: number;
  init: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  type: 'melee' | 'ranged' | 'support' | 'heavy';
  skills: string[];
  statusEffects: string[];
}

export interface TurnOrderEntry {
  unitId: string;
  order: number;
  reason: string;
}

export interface TurnOrderResult {
  entries: TurnOrderEntry[];
  overallReason: string;
  nextStepSuggestion: string;
  checksum: string;
}

export interface BattleReport {
  id: string;
  createdAt: number;
  scenarioName: string;
  units: Unit[];
  turnOrder: TurnOrderResult;
  corrected: boolean;
  correctionNote: string;
  version: number;
}

export interface HistorySnapshot {
  id: string;
  reportId: string;
  timestamp: number;
  action: 'import' | 'review' | 'correct' | 'batch' | 'export';
  summary: string;
  data: BattleReport;
}

export interface FilterCondition {
  faction?: 'steam' | 'gear' | 'clockwork' | 'all';
  scenarioName?: string;
  dateFrom?: number;
  dateTo?: number;
  corrected?: boolean;
}

export interface BatchJob {
  id: string;
  createdAt: number;
  reports: BattleReport[];
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
  total: number;
  logs: BatchLogEntry[];
}

export interface BatchLogEntry {
  timestamp: number;
  level: 'ok' | 'err' | 'warn';
  message: string;
}

export interface AppState {
  currentReport: BattleReport | null;
  currentFilter: FilterCondition;
  batchJob: BatchJob | null;
  activePanel: 'import' | 'review' | 'correct' | 'history' | 'export';
}

export interface ExportOptions {
  format: 'json' | 'text' | 'csv';
  includeReasons: boolean;
  includeNextSteps: boolean;
  filter: FilterCondition;
}

export const FACTION_LABELS: Record<string, string> = {
  steam: '蒸汽派',
  gear: '齿轮派',
  clockwork: '发条派',
};

export const TYPE_LABELS: Record<string, string> = {
  melee: '近战',
  ranged: '远程',
  support: '辅助',
  heavy: '重装',
};

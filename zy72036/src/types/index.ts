export interface GameState {
  resources: number;
  score: number;
  risk: number;
  isNegative: boolean;
}

export interface ZoneEffect {
  resources?: number;
  score?: number;
  risk?: number;
  formula?: string;
  description?: string;
}

export interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  effect: ZoneEffect;
  style: Record<string, string>;
}

export interface DraggableElement {
  id: string;
  label: string;
  emoji: string;
  baseValue: number;
}

export interface CalculationTrace {
  id: string;
  operationId: string;
  formula: string;
  variables: Record<string, number>;
  steps: Array<{
    description: string;
    value: number;
  }>;
  result: number;
  ruleId: string;
}

export interface OperationRecord {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'drag' | 'click';
  elementId: string;
  elementLabel?: string;
  zoneId?: string;
  zoneName?: string;
  stateBefore: GameState;
  stateAfter: GameState;
  calculationTrace: CalculationTrace;
  operator: string;
  source: string;
}

export interface DiffChunk {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface NoteRevision {
  id: string;
  noteId: string;
  oldContent: string;
  newContent: string;
  diff: DiffChunk[];
  createdAt: number;
  author: string;
  reason: string;
}

export interface Note {
  id: string;
  sessionId: string;
  type: 'original' | 'supplementary';
  content: string;
  author: string;
  createdAt: number;
  source: string;
  revisions?: NoteRevision[];
}

export interface CalculationRule {
  id: string;
  name: string;
  condition: string;
  formula: string;
  description: string;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  initialState: GameState;
  zones: Zone[];
  elements: DraggableElement[];
  rawNotes: string;
  rules: CalculationRule[];
  source: string;
  createdAt: number;
}

export interface GameSession {
  id: string;
  levelId: string;
  levelName: string;
  startTime: number;
  endTime?: number;
  operator: string;
  source: string;
  currentState: GameState;
  records: OperationRecord[];
  notes: Note[];
  finalState?: GameState;
}

export const STORAGE_KEYS = {
  CURRENT_SESSION: 'skatepark_current_session',
  LEVELS: 'skatepark_levels',
  CURRENT_LEVEL_ID: 'skatepark_current_level_id',
  OPERATOR_NAME: 'skatepark_operator_name',
  HISTORY: 'skatepark_history',
};

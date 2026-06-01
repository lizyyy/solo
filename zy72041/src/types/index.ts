export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Level {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  totalRounds: number;
  totalScore: number;
  rounds: Round[];
  createdAt: string;
  teacherNote?: string;
}

export interface Round {
  id: number;
  title: string;
  description: string;
  scene: string;
  evidence: EvidenceItem[];
  choices: Choice[];
  correctChoiceId: string;
  deductionReasons: DeductionReason[];
}

export interface EvidenceItem {
  id: string;
  source: string;
  content: string;
  value: number | string | null;
  highlight: boolean;
}

export interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  reasonReference: string;
}

export interface DeductionReason {
  id: string;
  reason: string;
  evidence: string;
  deduction: number;
}

export interface GameState {
  gameId: string;
  levelId: string;
  status: 'idle' | 'playing' | 'paused' | 'completed' | 'error';
  currentRound: number;
  totalRounds: number;
  score: number;
  maxScore: number;
  playerChoices: PlayerChoice[];
  startTime: number;
  endTime?: number;
  pausedAt?: number;
  resumedAt?: number;
  totalPauseTime: number;
  historyGameIds: string[];
  importData?: ImportedData;
  conflicts?: DataConflict[];
  errorMessage?: string;
}

export interface PlayerChoice {
  roundId: number;
  choiceId: string;
  isCorrect: boolean;
  score: number;
  timestamp: number;
  reason: string;
  deductionReasonId?: string;
}

export interface ImportedData {
  source: string;
  data: Record<string, JsonValue>;
  importedAt: number;
  teacherNote?: string;
}

export interface DataConflict {
  id: string;
  field: string;
  presetValue: JsonValue;
  importedValue: JsonValue;
  presetEvidence: string;
  importedEvidence: string;
  suggestion: string;
  resolved: boolean;
  resolution?: 'use_preset' | 'use_imported';
}

export interface ExportReport {
  gameId: string;
  levelTitle: string;
  playerName?: string;
  finalScore: number;
  maxScore: number;
  totalRounds: number;
  correctCount: number;
  startTime: string;
  endTime: string;
  totalPauseTime: number;
  pauseCount: number;
  restartCount: number;
  keyChoices: KeyChoice[];
  deductionSummary: DeductionSummary[];
  teacherNote?: string;
  exportedAt: string;
  source: string;
}

export interface KeyChoice {
  round: number;
  roundTitle: string;
  choice: string;
  isCorrect: boolean;
  score: number;
  reason: string;
  evidence: string;
}

export interface DeductionSummary {
  reason: string;
  evidence: string;
  deduction: number;
  round: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EmptyValueReport {
  field: string;
  path: string;
  defaultValue: JsonValue;
}

export interface DuplicateReport {
  field: string;
  duplicates: JsonValue[];
  count: number;
}

export interface BoundaryReport {
  field: string;
  value: JsonValue;
  type: 'min' | 'max' | 'edge';
  message: string;
}

export type GameAction =
  | { type: 'START_GAME'; payload: { levelId: string; importData?: ImportedData } }
  | { type: 'MAKE_CHOICE'; payload: { choiceId: string } }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'COMPLETE_GAME' }
  | { type: 'RESOLVE_CONFLICT'; payload: { conflictId: string; resolution: 'use_preset' | 'use_imported' } }
  | { type: 'SET_ERROR'; payload: { message: string } }
  | { type: 'CLEAR_ERROR' };

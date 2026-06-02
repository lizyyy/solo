export interface ProblemOption {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
}

export interface WarehouseReceiptProblem {
  id: string;
  order: number;
  title: string;
  description: string;
  timeLimit: number;
  options: ProblemOption[];
  correctOptionId: string;
  ruleReferences: string[];
  scoring: {
    correct: number;
    wrong: number;
    timeout: number;
  };
}

export interface BusinessRule {
  id: string;
  code: string;
  title: string;
  description: string;
}

export interface PlayerChoiceRecord {
  problemId: string;
  optionId: string | null;
  responseTime: number;
  timestamp: number;
}

export interface TeacherNote {
  problemId?: string;
  timestamp: number;
  content: string;
  author: string;
  isSupplementary?: boolean;
}

export type TimelineEventType =
  | 'problem_start'
  | 'player_choice'
  | 'judgment'
  | 'timeout'
  | 'note_added'
  | 'control_action'
  | 'session_start'
  | 'session_end';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: number;
  sessionTime: number;
  problemId?: string;
  data: Record<string, unknown>;
}

export interface JudgmentStep {
  step: string;
  condition: string;
  result: boolean;
  note?: string;
}

export interface JudgmentResult {
  isCorrect: boolean;
  failureType?: 'rule_misunderstanding' | 'operation_timeout';
  scoreChange: number;
  reasons: string[];
  ruleReferences: string[];
  judgmentChain: JudgmentStep[];
}

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface GameSession {
  id: string;
  levelId: string;
  status: SessionStatus;
  startTime: number | null;
  endTime: number | null;
  pausedTime: number;
  totalPausedDuration: number;
  currentProblemIndex: number;
  currentProblemStartTime: number | null;
  remainingTime: number;
  score: number;
  events: TimelineEvent[];
  judgments: Record<string, JudgmentResult>;
  playerChoices: Record<string, PlayerChoiceRecord>;
  notes: TeacherNote[];
  originalNotesCount: number;
}

export interface ProblemResult {
  problemId: string;
  problemTitle: string;
  isCorrect: boolean;
  failureType?: 'rule_misunderstanding' | 'operation_timeout';
  playerChoice: string | null;
  playerChoiceLabel?: string;
  correctChoice: string;
  correctChoiceLabel: string;
  responseTime: number;
  scoreChange: number;
  reasons: string[];
  rules: string[];
}

export interface SettlementReport {
  sessionId: string;
  levelName: string;
  levelDescription: string;
  totalScore: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  timeoutCount: number;
  totalProblems: number;
  accuracy: number;
  avgResponseTime: number;
  failureBreakdown: {
    ruleMisunderstanding: number;
    operationTimeout: number;
  };
  problemDetails: ProblemResult[];
  humanReadableSummary: string;
  supplementaryNoteDiff: string | null;
  rawSessionData: GameSession;
  exportedAt: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  problems: WarehouseReceiptProblem[];
  rules: BusinessRule[];
  preRecordedChoices?: PlayerChoiceRecord[];
  teacherNotes?: TeacherNote[];
}

export interface GameState {
  levels: Level[];
  rules: BusinessRule[];

  currentLevelId: string | null;
  session: GameSession | null;

  replayMode: boolean;
  replayEventIndex: number;
  isReplayPlaying: boolean;

  showSettlement: boolean;
  showNoteEditor: boolean;
  selectedEventId: string | null;

  settlementReport: SettlementReport | null;

  loadLevel: (levelId: string) => void;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  restartSession: () => void;
  settleSession: () => SettlementReport | null;
  makeChoice: (optionId: string) => void;
  addNote: (problemId: string | null, content: string) => string;
  nextProblem: () => void;
  tickTimer: () => void;
  runPreRecorded: () => void;
  startReplay: () => void;
  exitReplay: () => void;
  replayNext: () => void;
  replayPrev: () => void;
  replayGoTo: (index: number) => void;
  replayAutoPlay: () => void;
  replayPause: () => void;
  exportReport: (format: 'json' | 'text') => string;
  setShowNoteEditor: (show: boolean) => void;
  setShowSettlement: (show: boolean) => void;
  setSelectedEventId: (id: string | null) => void;
  reset: () => void;
}

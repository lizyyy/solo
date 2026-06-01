export interface LevelGroup {
  id: string;
  name: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  order: number;
}

export interface LevelOption {
  id: string;
  label: string;
  notes: string[];
  isCorrect: boolean;
}

export interface Level {
  id: string;
  groupId: string;
  targetChord: string;
  targetNotes: string[];
  options: LevelOption[];
  timeLimit: number;
  hint: string;
  order: number;
}

export interface Session {
  id: string;
  groupId: string;
  startTime: number;
  endTime: number | null;
  score: number;
  combo: number;
  maxCombo: number;
  status: "playing" | "paused" | "completed" | "abandoned";
}

export interface SessionStep {
  id: string;
  sessionId: string;
  levelId: string;
  stepOrder: number;
  selectedOption: string | null;
  correct: boolean;
  timeSpent: number;
  failType: "rule_misunderstood" | "too_slow" | null;
  timestamp: number;
}

export interface TeacherNote {
  id: string;
  sessionId: string;
  source: "import" | "supplement";
  content: string;
  timestamp: number;
}

export interface SupplementNote {
  id: string;
  sessionId: string;
  content: string;
  createdAt: number;
  diffType: "added" | "changed" | "conflict";
  previousContent?: string;
}

export interface ConflictItem {
  field: string;
  originalValue: string;
  importValue: string;
  resolution: "keep_original" | "use_import" | "unresolved";
}

export type GameStatus = "idle" | "playing" | "paused" | "completed";

export interface FeedbackInfo {
  correct: boolean;
  failType: "rule_misunderstood" | "too_slow" | null;
  message: string;
  detail: string;
}

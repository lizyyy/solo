export type NoteType = 
  | 'quarter' 
  | 'eighth' 
  | 'sixteenth' 
  | 'half' 
  | 'whole' 
  | 'dotted-quarter' 
  | 'dotted-eighth' 
  | 'rest-quarter' 
  | 'rest-eighth' 
  | 'rest-half';

export type ErrorType = 
  | 'dot-misplaced' 
  | 'rest-missed' 
  | 'measure-overflow' 
  | 'wrong-duration' 
  | 'slot-occupied';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface NoteCard {
  id: string;
  type: NoteType;
  duration: number;
  name: string;
  hasDot?: boolean;
  isRest?: boolean;
}

export interface WorkSlot {
  id: string;
  measureIndex: number;
  slotIndex: number;
  assignedNote: NoteCard | null;
  isFixed: boolean;
  errorState?: ErrorType | null;
}

export interface Measure {
  id: string;
  index: number;
  slots: WorkSlot[];
  targetBeats: number;
  currentBeats: number;
  isLoaded: boolean;
}

export interface Level {
  id: string;
  name: string;
  difficulty: Difficulty;
  timeSignature: { numerator: number; denominator: number };
  measures: Measure[];
  notePool: NoteCard[];
  perfectScore: number;
  description: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorType?: ErrorType;
  errorMessage: string;
  affectedElement?: string;
}

export interface ActionRecord {
  id: string;
  timestamp: number;
  type: 'place' | 'remove' | 'swap';
  noteId: string;
  slotId: string;
  validation: ValidationResult;
}

export interface CorrectionChange {
  slotId: string;
  oldNote: NoteCard | null;
  newNote: NoteCard | null;
  justification: string;
}

export interface CorrectionRecord {
  id: string;
  timestamp: number;
  levelId: string;
  originalScore: number;
  newScore: number;
  reason: string;
  teacherName: string;
  changes: CorrectionChange[];
}

export interface GameState {
  currentLevel: Level | null;
  currentScore: number;
  accuracy: number;
  actionHistory: ActionRecord[];
  isComplete: boolean;
  placedNotes: Map<string, string>;
  feedbackMessage: { type: 'success' | 'error' | 'info'; message: string } | null;
}

export interface CompletedLevel {
  levelId: string;
  score: number;
  accuracy: number;
  completedAt: number;
  stars: number;
}

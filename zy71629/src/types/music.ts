export type Accidental = '#' | 'b' | 'natural';

export type ChordQuality = 'maj' | 'min' | 'dom' | 'dim' | 'aug';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Note {
  pitch: string;
  octave: number;
  accidental: Accidental;
  duration: number;
}

export interface Chord {
  id: string;
  symbol: string;
  root: string;
  quality: ChordQuality;
  extensions: string[];
  allowedNotes: string[];
  passingNotes: string[];
}

export interface Phrase {
  id: string;
  name: string;
  notes: Note[];
  totalDuration: number;
  difficulty: Difficulty;
  compatibleChords: string[];
  tags: string[];
}

export interface ChordProgression {
  id: string;
  name: string;
  chords: { chordId: string; measure: number; beat: number }[];
  totalMeasures: number;
}

export interface RhythmPattern {
  id: string;
  timeSignature: [number, number];
  bpm: number;
  swingFactor?: number;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  chordProgressionId: string;
  rhythmPatternId: string;
  availablePhraseIds: string[];
  classId: string;
  createdAt: number;
  dueDate?: number;
}

export type ErrorType = 'data' | 'rule' | 'material';

export interface ErrorDetail {
  id: string;
  type: ErrorType;
  measure: number;
  beat: number;
  description: string;
  deduction: number;
  suggestion: string;
}

export interface Move {
  id: string;
  measureNumber: number;
  phraseId: string;
  phrase: Phrase;
  timestamp: number;
  isCorrect: boolean;
  errors: ErrorDetail[];
  chordScore: number;
  rhythmScore: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface Score {
  chordScore: number;
  rhythmScore: number;
  totalScore: number;
  grade: Grade;
  errors: ErrorDetail[];
  keyDecisions: {
    measure: number;
    choice: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  suggestions: string[];
}

export interface GameSession {
  id: string;
  gameId: string;
  studentId: string;
  studentName: string;
  startTime: number;
  endTime?: number;
  moves: Move[];
  score?: Score;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: number;
}

export interface Student {
  id: string;
  name: string;
  classId: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
}

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  joinCode: string;
  students: Student[];
}

export interface FeedbackMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export type UserRole = 'student' | 'teacher' | null;

export interface UserState {
  role: UserRole;
  student: Student | null;
  teacher: Teacher | null;
  classId: string | null;
}

export interface MaterialLibrary {
  chords: Chord[];
  phrases: Phrase[];
  chordProgressions: ChordProgression[];
  rhythmPatterns: RhythmPattern[];
}

export type ExportFormat = 'json' | 'csv' | 'pdf';

export interface PlaybackState {
  isPlaying: boolean;
  currentMeasure: number;
  currentBeat: number;
  playbackSpeed: number;
  filteredErrorTypes: ErrorType[];
}

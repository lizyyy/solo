export interface Note {
  id: string;
  step: number;
  velocity: number;
  isActive: boolean;
}

export interface DrumTrack {
  id: string;
  name: string;
  color: string;
  sampleUrl: string;
  volume: number;
  pan: number;
  notes: Note[];
  muted: boolean;
  solo: boolean;
}

export interface Pattern {
  id: string;
  name: string;
  bpm: number;
  steps: 16 | 32;
  tracks: DrumTrack[];
  createdAt: string;
  updatedAt: string;
  author: string;
  isDirty: boolean;
}

export interface HistoryVersion {
  id: string;
  patternId: string;
  snapshot: Pattern;
  timestamp: string;
  author: string;
  message: string;
  isConflict: boolean;
}

export type ValidationIssueType = 
  | 'velocity_over' 
  | 'velocity_low' 
  | 'density_high' 
  | 'empty_measure'
  | 'overwrite_warning';

export type ValidationSeverity = 'warning' | 'error';

export interface ValidationIssue {
  id: string;
  type: ValidationIssueType;
  severity: ValidationSeverity;
  trackId: string;
  step: number;
  message: string;
  suggestion?: string;
}

export interface DrumSample {
  name: string;
  url: string;
  category: string;
}

export interface DrumKit {
  id: string;
  name: string;
  samples: Record<string, DrumSample>;
}

export interface WeeklyRecord {
  id: string;
  weekKey: string;
  title: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'finalized';
  operator: string;
  createdAt: string;
  updatedAt: string;
}

export type FileType = 'audio' | 'image' | 'text' | 'tracklist' | 'unknown';
export type FileStatus = 'success' | 'warning' | 'error' | 'processing';

export interface FileItem {
  id: string;
  recordId: string;
  name: string;
  type: FileType;
  fileHash?: string;
  size: number;
  status: FileStatus;
  errorReason?: string;
  warningReason?: string;
  uploadTime: string;
  metadata: Record<string, any>;
  previewUrl?: string;
  duration?: number;
}

export interface Track {
  id: string;
  recordId: string;
  fileId?: string;
  name: string;
  trackNo: number;
  composer?: string;
  duration?: number;
  expectedDuration?: number;
  status: 'matched' | 'unmatched' | 'processing' | 'manual';
  manualNote?: string;
  rawData: Record<string, any>;
}

export type AnnotationSource = 'chat' | 'manual' | 'contract' | 'ocr';

export interface Annotation {
  id: string;
  recordId: string;
  trackId?: string;
  source: AnnotationSource;
  content: string;
  author: string;
  timestamp: string;
  evidence?: {
    type: 'image' | 'text' | 'ocr';
    reference: string;
  };
}

export type ConflictType = 'duration_mismatch' | 'name_mismatch' | 'status_conflict' | 'annotation_conflict';
export type ConflictResolution = 'use_a' | 'use_b' | 'keep_both' | 'unresolved';

export interface Conflict {
  id: string;
  recordId: string;
  trackId: string;
  type: ConflictType;
  sideA: {
    source: string;
    value: string;
    evidence?: string;
  };
  sideB: {
    source: string;
    value: string;
    evidence?: string;
  };
  suggestion: string;
  resolution: ConflictResolution;
  resolvedBy?: string;
  resolutionNote?: string;
  resolvedAt?: string;
}

export interface Note {
  id: string;
  recordId: string;
  trackId?: string;
  content: string;
  author: string;
  isSupplement: boolean;
  previousContent?: string;
  createdAt: string;
}

export interface WeeklyReport {
  recordId: string;
  generatedAt: string;
  summary: {
    totalTracks: number;
    totalDuration: number;
    matchedTracks: number;
    unmatchedTracks: number;
    conflicts: number;
    resolvedConflicts: number;
    annotations: number;
    notes: number;
  };
  content: string;
  anomalies: Array<{
    trackId: string;
    trackName: string;
    issue: string;
    status: string;
    handler?: string;
    handledAt?: string;
  }>;
}

export interface ImportResult {
  success: number;
  warning: number;
  error: number;
  files: FileItem[];
}

export interface AppState {
  currentRecordId: string | null;
  records: WeeklyRecord[];
  files: FileItem[];
  tracks: Track[];
  annotations: Annotation[];
  conflicts: Conflict[];
  notes: Note[];
  reports: Record<string, WeeklyReport>;
}

export type AppAction =
  | { type: 'SET_CURRENT_RECORD'; payload: string | null }
  | { type: 'ADD_RECORD'; payload: WeeklyRecord }
  | { type: 'UPDATE_RECORD'; payload: WeeklyRecord }
  | { type: 'SET_RECORDS'; payload: WeeklyRecord[] }
  | { type: 'ADD_FILES'; payload: FileItem[] }
  | { type: 'UPDATE_FILE'; payload: FileItem }
  | { type: 'SET_FILES'; payload: FileItem[] }
  | { type: 'SET_TRACKS'; payload: Track[] }
  | { type: 'UPDATE_TRACK'; payload: Track }
  | { type: 'SET_ANNOTATIONS'; payload: Annotation[] }
  | { type: 'ADD_ANNOTATION'; payload: Annotation }
  | { type: 'SET_CONFLICTS'; payload: Conflict[] }
  | { type: 'UPDATE_CONFLICT'; payload: Conflict }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'SET_REPORT'; payload: { recordId: string; report: WeeklyReport } }
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'RESET_STATE' };

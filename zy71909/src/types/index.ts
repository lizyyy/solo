export interface VoicePart {
  id: string;
  name: 'soprano' | 'alto' | 'tenor' | 'bass';
  displayName: string;
  color: string;
}

export interface Student {
  id: string;
  name: string;
  voicePartId: string;
  previousVoicePart?: string;
  partChanged?: boolean;
  partChangeBatchId?: string;
}

export interface RecordingBatch {
  id: string;
  title: string;
  rehearsalDate: string;
  songName: string;
  keySignature: string;
  keyChanged?: boolean;
  previousKey?: string;
  recordingFileName?: string;
  totalMeasures: number;
  missingMeasures?: number[];
  status: 'draft' | 'reviewed' | 'final';
}

export type NoteSource = 'monitor' | 'teacher' | 'selection';

export interface Note {
  id: string;
  batchId: string;
  source: NoteSource;
  content: string;
  author: string;
  createdAt: string;
  relatedMeasure?: number;
  relatedStudentId?: string;
}

export type AnomalyType = 'key_change' | 'part_change' | 'missing_measure' | 'manual';
export type DeviationCategory = 'persistent' | 'occasional' | 'unreviewed' | 'normal';

export interface PitchDeviation {
  id: string;
  studentId: string;
  batchId: string;
  measure: number;
  deviationCents: number;
  isAnomaly: boolean;
  anomalyType?: AnomalyType;
  anomalyReason?: string;
  reviewed: boolean;
  category?: DeviationCategory;
  manualAnnotation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Filters {
  voicePartId: string | null;
  category: DeviationCategory | null;
  showAnomaliesOnly: boolean;
}

export interface AppState {
  batches: RecordingBatch[];
  students: Student[];
  voiceParts: VoicePart[];
  deviations: PitchDeviation[];
  notes: Note[];
  selectedBatchId: string | null;
  selectedDeviationId: string | null;
  sidebarOpen: boolean;
  entryPanelOpen: boolean;
  filters: Filters;
}

export interface AppActions {
  setSelectedBatchId: (id: string | null) => void;
  setSelectedDeviationId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setEntryPanelOpen: (open: boolean) => void;
  setFilters: (filters: Partial<Filters>) => void;
  updateDeviation: (id: string, updates: Partial<PitchDeviation>) => void;
  addDeviation: (deviation: Omit<PitchDeviation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => void;
  addBatch: (batch: Omit<RecordingBatch, 'id'>) => void;
  markAsReviewed: (deviationId: string) => void;
  toggleAnomaly: (deviationId: string, reason?: string) => void;
  classifyDeviations: () => void;
  exportReport: () => void;
}

export interface TrendDataPoint {
  date: string;
  batchId: string;
  average: number;
  [key: string]: number | string;
}

export interface HeatmapCellData {
  studentId: string;
  studentName: string;
  measure: number;
  deviationCents: number;
  isAnomaly: boolean;
  anomalyType?: AnomalyType;
  category?: DeviationCategory;
  reviewed: boolean;
  deviationId: string;
}

export interface CategoryStats {
  persistent: number;
  occasional: number;
  unreviewed: number;
  normal: number;
}

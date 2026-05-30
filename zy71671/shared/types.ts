export type Key = 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb' | 'E' | 'F' | 'F#' | 'Gb' | 'G' | 'G#' | 'Ab' | 'A' | 'A#' | 'Bb' | 'B';

export type SetlistStatus = 'draft' | 'reviewing' | 'approved' | 'needs_review' | 'validated' | 'has_warnings' | 'has_errors';

export type ConflictType = 'key_conflict' | 'duration_over' | 'old_version' | 'vocal_range' | 'instrument';

export type Severity = 'error' | 'warning';

export interface VocalRange {
  min: string;
  max: string;
}

export interface InstrumentTunings {
  guitar?: string;
  bass?: string;
  keys?: string;
}

export interface Song {
  id: string;
  setlistId: string;
  name: string;
  originalKey: Key;
  currentKey: Key;
  duration: number;
  order: number;
  vocalRange?: VocalRange;
  vocalNotes?: string;
  instrumentTunings?: InstrumentTunings;
  version: number;
  lastUpdated: string;
  updatedBy: string;
  updateReason?: string;
}

export interface CheckResultSummary {
  passed: number;
  errors: number;
  warnings: number;
}

export interface Setlist {
  id: string;
  tourName: string;
  venue: string;
  date: string;
  maxDuration: number;
  status: SetlistStatus;
  currentVersion: number;
  createdAt: string;
  lastValidated?: string;
  songs?: Song[];
  totalDuration: number;
  songCount: number;
  version: number;
  lastUpdated: string;
  lastCheckResult?: CheckResultSummary;
}

export interface KeyFormatCheck {
  passed: boolean;
  message: string;
  suggestion?: string;
}

export interface VocalRangeCheck {
  passed: boolean;
  message: string;
  details?: {
    originalNote: string;
    transposedNote: string;
    vocalistMax: string;
    semitoneDiff: number;
  };
}

export interface InstrumentTuningCheck {
  passed: boolean;
  message: string;
  suggestion?: string;
}

export interface DurationCheck {
  passed: boolean;
  message: string;
}

export interface ValidationResult {
  songId: string;
  songName: string;
  passed: boolean;
  severity: Severity;
  checkType: string;
  message: string;
  suggestion?: string;
  details?: Record<string, unknown>;
  checks?: {
    keyFormat: KeyFormatCheck;
    vocalRange: VocalRangeCheck;
    instrumentTuning: InstrumentTuningCheck;
    duration: DurationCheck;
  };
}

export interface CheckReportSummary {
  total: number;
  passed: number;
  warnings: number;
  errors: number;
  byType: Record<string, number>;
  totalSongs?: number;
  totalDuration?: number;
  maxDuration?: number;
  overDuration?: number;
}

export interface InvalidKeyInfo {
  songId: string;
  songName: string;
  invalidKey: string;
  suggestion: string;
}

export interface OldVersionInfo {
  songId: string;
  songName: string;
  currentVersion: number;
  latestVersion: number;
}

export interface KeyChecks {
  validKeys: number;
  invalidKeys: InvalidKeyInfo[];
  oldVersionMixins: OldVersionInfo[];
}

export interface DurationPerSong {
  songId: string;
  songName: string;
  duration: number;
  cumulative: number;
}

export interface DurationBreakdown {
  source: string;
  value: number;
  explanation: string;
}

export interface DurationAnalysis {
  perSong: DurationPerSong[];
  breakdown: DurationBreakdown[];
}

export interface ConflictTrace {
  field: string;
  value: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Conflict {
  type: ConflictType;
  severity: Severity;
  songId: string;
  songName: string;
  message: string;
  suggestion: string;
  trace: ConflictTrace[];
}

export interface ReportSongDuration {
  name: string;
  key: string;
  duration: number;
}

export interface ReportDurationBreakdown {
  total: number;
  limit: number;
  songDurations: ReportSongDuration[];
}

export interface CheckReport {
  id: string;
  setlistId: string;
  generatedAt: string;
  generatedBy: string;
  summary: CheckReportSummary;
  keyChecks: KeyChecks;
  durationAnalysis: DurationAnalysis;
  durationBreakdown: ReportDurationBreakdown;
  conflicts: Conflict[];
  validations: ValidationResult[];
}

export interface FieldTraceHistory {
  version: number;
  value: unknown;
  updatedAt: string;
  updatedBy: string;
  reason: string;
  diff: unknown;
}

export interface FieldTraceChange {
  version: number;
  oldValue?: unknown;
  newValue: unknown;
  timestamp: string;
  updatedBy: string;
  reason?: string;
}

export interface FieldTrace {
  field: string;
  currentValue: unknown;
  calculationRule?: string;
  sourceFields?: string[];
  history: FieldTraceHistory[];
  changeHistory: FieldTraceChange[];
}

export interface SongVersion {
  id: number;
  songId: string;
  version: number;
  fieldName: string;
  oldValue?: string;
  newValue: string;
  updatedAt: string;
  updatedBy: string;
  reason?: string;
}

export interface SetlistVersion {
  id: number;
  setlistId: string;
  version: number;
  snapshot: string;
  createdAt: string;
  createdBy: string;
  description?: string;
}

export interface CreateSetlistRequest {
  tourName: string;
  venue: string;
  date: string;
  maxDuration: number;
  updatedBy?: string;
}

export interface UpdateSetlistRequest {
  tourName?: string;
  venue?: string;
  date?: string;
  maxDuration?: number;
  updatedBy: string;
  updateReason?: string;
}

export interface CreateSongRequest {
  name: string;
  originalKey: Key;
  currentKey: Key;
  duration: number;
  order: number;
  vocalRange?: VocalRange;
  vocalNotes?: string;
  instrumentTunings?: InstrumentTunings;
  updatedBy: string;
  updateReason?: string;
}

export interface UpdateSongRequest {
  name?: string;
  originalKey?: Key;
  currentKey?: Key;
  duration?: number;
  order?: number;
  vocalRange?: VocalRange;
  vocalNotes?: string;
  instrumentTunings?: InstrumentTunings;
  updatedBy: string;
  updateReason?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

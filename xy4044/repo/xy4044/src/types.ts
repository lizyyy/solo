export const SESSION_VERSION = '1.0.0';

export type SourceType = 'microphone' | 'camera' | 'remote_stream' | 'local_file';

export type EventType = 'clap_peak' | 'flash_frame' | 'rtp_timestamp' | 'manual_anchor';

export type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'none';

export type ProblemType = 
  | 'clock_drift'
  | 'frame_drop'
  | 'sample_rate_mismatch'
  | 'duplicate_source'
  | 'anchor_conflict'
  | 'jitter_too_high'
  | 'insufficient_anchors';

export type Severity = 'critical' | 'warning' | 'info';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  sampleRate?: number;
  frameRate?: number;
  delayOffset: number;
  isActive: boolean;
  isInMix: boolean;
  color: string;
  notes?: string;
}

export interface Event {
  id: string;
  sourceId: string;
  type: EventType;
  timestamp: number;
  value?: number;
  rtpTimestamp?: number;
  description?: string;
  confidence: number;
  tags?: string[];
}

export interface CalibrationResult {
  sourceId: string;
  delayOffset: number;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  evidence: CalibrationEvidence[];
  isManualOverride: boolean;
  driftRate?: number;
  calculatedAt: number;
}

export interface CalibrationEvidence {
  type: EventType;
  sourceTimestamp: number;
  referenceTimestamp: number;
  delta: number;
  confidence: number;
}

export interface Problem {
  id: string;
  type: ProblemType;
  severity: Severity;
  sourceId?: string;
  message: string;
  suggestion: string;
  affectedEvents?: string[];
  detectedAt: number;
  resolved: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
}

export interface SyncIssue {
  id: string;
  timeRange: [number, number];
  sources: string[];
  maxDeviation: number;
  description: string;
}

export interface ImportLog {
  sourceId: string;
  entries: ImportLogEntry[];
}

export interface ImportLogEntry {
  timestamp: number;
  type: string;
  value?: number;
  raw: Record<string, unknown>;
}

export interface Session {
  version: string;
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  timestampUnit: 'ms' | 's';
  sources: Source[];
  events: Event[];
  calibrationResults: CalibrationResult[];
  problems: Problem[];
  syncIssues: SyncIssue[];
  importLogs: ImportLog[];
  masterClockSourceId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
  warnings: ValidationError[];
}

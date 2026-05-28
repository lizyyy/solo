export interface AudioFile {
  id: string;
  filename: string;
  duration: number;
  sampleRate: number;
  channels: number;
  uploadedAt: string;
}

export interface BeatPoint {
  id: string;
  audioId: string;
  voicePart: string;
  timeMs: number;
  confidence: number;
  isManual: boolean;
  correctedFrom?: number;
}

export interface TempoMark {
  id: string;
  audioId: string;
  timeMs: number;
  bpm: number;
  type: "ritardando" | "accelerando" | "stable" | "custom";
  label: string;
}

export interface ClassNote {
  id: string;
  audioId: string;
  timeMsStart: number;
  timeMsEnd: number;
  content: string;
  screenshotUrl?: string;
  type: "text" | "correction" | "screenshot";
}

export interface AnalysisConfig {
  referenceBpm: number;
  driftThreshold: number;
  minSegmentLength: number;
  confidenceThreshold: number;
}

export interface DriftAnalysis {
  id: string;
  audioId: string;
  voicePart: string;
  createdAt: string;
  status: "pending" | "running" | "completed" | "failed";
  config: AnalysisConfig;
}

export interface MatchedBeat {
  detectedTime: number;
  referenceTime: number;
  offset: number;
  confidence: number;
  matched: boolean;
}

export interface DriftPoint {
  timeMs: number;
  driftMs: number;
  cumulativeDriftMs: number;
}

export interface CalculationDetail {
  sumDrift: number;
  sumDriftSquared: number;
  formulaMean: string;
  formulaVariance: string;
}

export interface SegmentStat {
  segmentId: string;
  label: string;
  startMs: number;
  endMs: number;
  meanDrift: number;
  variance: number;
  maxDrift: number;
  beatCount: number;
  calculationDetail: CalculationDetail;
}

export interface AnomalyRegion {
  id: string;
  startMs: number;
  endMs: number;
  severity: "low" | "medium" | "high";
  driftAtStart: number;
  driftAtEnd: number;
  tag: string;
}

export interface AuditEntry {
  step: string;
  formula: string;
  inputs: Record<string, number>;
  output: number;
  timestamp: string;
}

export interface DriftResult {
  matchedBeats: MatchedBeat[];
  driftCurve: DriftPoint[];
  segments: SegmentStat[];
  anomalyRegions: AnomalyRegion[];
  auditTrail: AuditEntry[];
}

export type ErrorCauseType = "weak_beat" | "tempo_change" | "voice_masking";
export type NextAction = "manual_correct" | "ignore" | "redetect";

export interface ErrorCause {
  id: string;
  analysisId: string;
  type: ErrorCauseType;
  timeMsStart: number;
  timeMsEnd: number;
  reason: string;
  impactScore: number;
  impactRange: string;
  affectedBeatIds: string[];
  nextAction: NextAction;
  nextActionReason: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export type SubmissionType = "normal" | "supplementary" | "withdrawn" | "duplicate";
export type ReportStatus = "draft" | "submitted" | "withdrawn" | "supplementary" | "duplicate";

export interface DriftReport {
  id: string;
  analysisId: string;
  createdAt: string;
  submissionType: SubmissionType;
  status: ReportStatus;
  supplementaryReason?: string;
  withdrawnReason?: string;
  duplicateOf?: string;
}

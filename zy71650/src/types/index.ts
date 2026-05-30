export interface ADSRParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface AnomalyFlag {
  id: string;
  type: 'onset_misjudgment' | 'noise_interference' | 'parameter_out_of_bounds';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedParam: string;
}

export interface AuditEntry {
  id: string;
  recordId: string;
  operationType: 'fit' | 'peak_detect' | 'param_interpret' | 'chart_export' | 'history_compare';
  judgment: string;
  createdAt: string;
}

export interface NoteVersion {
  id: string;
  recordId: string;
  content: string;
  version: number;
  createdAt: string;
  isCurrent: boolean;
}

export interface FittingRecord {
  id: string;
  fileId: string;
  instrumentLabel: string;
  bpm: number | null;
  raw: ADSRParams;
  corrected: ADSRParams | null;
  conclusion: ADSRParams;
  anomalies: AnomalyFlag[];
  notes: NoteVersion[];
  auditEntries: AuditEntry[];
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AudioFileInfo {
  fileId: string;
  fileName: string;
  duration: number;
  sampleRate: number;
  bpm: number | null;
  bpmConfidence: number;
  waveform: number[];
}

export interface PeakInfo {
  peakAmplitude: number;
  peakSample: number;
  steadyStateAmplitude: number;
  steadyStateStart: number;
  steadyStateEnd: number;
  releaseEnd: number;
}

export interface ParamDifference {
  param: keyof ADSRParams;
  values: { recordId: string; value: number }[];
  maxDiff: number;
  maxDiffPercent: number;
}

export interface CoverageWarning {
  oldRecordId: string;
  newRecordId: string;
  coveredParams: (keyof ADSRParams)[];
  message: string;
}

export interface CompareResponse {
  records: FittingRecord[];
  differences: ParamDifference[];
  coverageWarnings: CoverageWarning[];
}

export type AnomalyType = AnomalyFlag['type'];
export type OperationType = AuditEntry['operationType'];
export type SeverityLevel = AnomalyFlag['severity'];

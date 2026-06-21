export type SampleStatus = 'raw' | 'dirty' | 'clean' | 'confirmed' | 'withdrawn';
export type AnomalyType = 'duplicate' | 'outlier' | 'boundary' | 'withdrawn';
export type FittingMethod = 'linear' | 'polynomial' | 'exponential' | 'logarithmic';

export interface SampleSource {
  studentId: string;
  draftId: string;
  fileName: string;
  uploadedAt: number;
  uploader: string;
  originalLine?: number;
  notes?: string;
}

export interface Sample {
  id: string;
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  status: SampleStatus;
  source: SampleSource;
  anomalies: Anomaly[];
  confirmedBy?: string;
  confirmedAt?: number;
  confirmedNotes?: string;
  withdrawnReason?: string;
  withdrawnAt?: number;
  correctionNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  description: string;
  detectedAt: number;
  detectedBy: string;
  relatedSampleIds?: string[];
  severity: 'low' | 'medium' | 'high';
  resolved?: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface FittingParams {
  id: string;
  method: FittingMethod;
  degree?: number;
  coefficients: number[];
  rSquared: number;
  sampleIds: string[];
  excludedSampleIds: string[];
  calculatedAt: number;
  calculatedBy: string;
  notes?: string;
}

export interface ChangeRecord {
  id: string;
  entityType: 'sample' | 'fitting' | 'anomaly';
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: number;
  changedBy: string;
  reason?: string;
}

export interface FittingSession {
  id: string;
  name: string;
  samples: Sample[];
  fittingParams: FittingParams[];
  activeFittingId?: string;
  changeHistory: ChangeRecord[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface FittingResult {
  params: FittingParams;
  predictedValues: Array<{ x: number; y: number }>;
  residuals: Array<{ sampleId: string; residual: number }>;
}


export type SampleStatus = 'pending' | 'detected' | 'reviewing' | 'completed';
export type SourceType = 'model' | 'manual' | 'online';
export type EvidenceType = 'model_output' | 'manual_label' | 'threshold_config';

export interface Sample {
  id: string;
  content: string;
  originalIntent: string;
  source: SourceType;
  status: SampleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  content: string;
  highlight?: string[];
}

export interface DetectionResult {
  id: string;
  sampleId: string;
  modelIntent: string;
  modelConfidence: number;
  manualIntent?: string;
  isDrift: boolean;
  driftScore: number;
  thresholdVersion: string;
  detectedAt: string;
  evidences: Evidence[];
  hasConflict: boolean;
}

export interface ReviewRecord {
  id: string;
  sampleId: string;
  reviewer: string;
  finalIntent: string;
  reason: string;
  remark?: string;
  isRemarkAdded: boolean;
  remarkDiff?: {
    before: string;
    after: string;
  };
  reviewedAt: string;
}

export interface VersionHistory {
  id: string;
  sampleId: string;
  version: number;
  field: string;
  oldValue: string;
  newValue: string;
  operator: string;
  operatedAt: string;
}

export interface Report {
  id: string;
  name: string;
  generatedAt: string;
  statistics: {
    totalSamples: number;
    modelDecision: number;
    manualCorrection: number;
    needReview: number;
    driftRate: number;
  };
  samples: {
    modelDecision: string[];
    manualCorrection: string[];
    needReview: string[];
  };
}

export interface TrendData {
  date: string;
  driftRate: number;
  totalSamples: number;
}

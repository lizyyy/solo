export type Label = 'pass' | 'reject' | 'uncertain';
export type FinalLabel = 'pass' | 'reject';
export type HistoryAction = 'import' | 'review' | 'confirm' | 'reject' | 'supplement' | 'recalc';
export type ConflictType = 'label_mismatch' | 'note_contradicts_gray';
export type ConflictResolution = 'confirm_gray' | 'reject_gray';
export type SelfCheckKey = 'dedupe' | 'lowconf_visible' | 'recalc_consistency' | 'export_match';

export interface GrayBatch {
  id: string;
  name: string;
  modelVersionA: string;
  modelVersionB: string;
  importedAt: number;
  sampleIds: string[];
  duplicateSkipped: number;
  recalcVersion: number;
}

export interface HistoryItem {
  id: string;
  sampleId: string;
  action: HistoryAction;
  operator: string;
  at: number;
  note?: string;
  snapshot: Partial<Sample>;
}

export interface Sample {
  id: string;
  batchId: string;
  content: string;
  confidenceA: number;
  confidenceB: number;
  labelA: Label;
  labelB: Label;
  grayLabel: Label;
  annotatorNote?: string;
  finalLabel?: FinalLabel;
  reviewedBy?: string;
  reviewedAt?: number;
  isLowConfidence: boolean;
  history: HistoryItem[];
  md5: string;
}

export interface ConflictEvidence {
  id: string;
  sampleId: string;
  batchId: string;
  type: ConflictType;
  graySide: string;
  annotatorSide: string;
  resolved: boolean;
  resolution?: ConflictResolution;
  resolvedBy?: string;
  resolvedReason?: string;
  resolvedAt?: number;
}

export interface SelfCheckItem {
  key: SelfCheckKey;
  pass: boolean;
  reason: string;
  relatedSampleIds: string[];
}

export interface SelfCheckReport {
  batchId: string;
  items: SelfCheckItem[];
  overallPass: boolean;
  generatedAt: number;
}

export interface BatchOverview {
  batch: GrayBatch;
  totalSamples: number;
  lowConfidenceCount: number;
  conflictCount: number;
  reviewedCount: number;
  avgConfidenceA: number;
  avgConfidenceB: number;
}

export interface BatchImportInput {
  batchId: string;
  batchName: string;
  modelVersionA: string;
  modelVersionB: string;
  samples: Array<{
    id: string;
    content: string;
    confidenceA: number;
    confidenceB: number;
    labelA: Label;
    labelB: Label;
    grayLabel: Label;
    annotatorNote?: string;
  }>;
}

export interface SupplementInput {
  batchId: string;
  samples: Array<{
    id: string;
    content: string;
    confidenceA: number;
    confidenceB: number;
    labelA: Label;
    labelB: Label;
    grayLabel: Label;
    annotatorNote?: string;
  }>;
}

export interface ResolveConflictInput {
  resolution: ConflictResolution;
  reason: string;
  operator: string;
}

export interface ReviewSampleInput {
  finalLabel: FinalLabel;
  operator: string;
  note?: string;
}

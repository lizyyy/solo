export type JudgmentType = 'correct' | 'incorrect' | 'partial' | 'unverified';
export type ResultStatus = 'pending' | 'processed' | 'manually_adjusted';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type AuditAction = 'create' | 'update' | 'delete' | 'add_manual_judgment' | 'add_note' | 'override';
export type EntityType = 'checkup_run' | 'sample_result' | 'manual_judgment' | 'note' | 'sampleResult' | 'checkupRun';

export interface ModelVersion {
  id: string;
  name: string;
  version: string;
  description: string;
  config: {
    threshold: number;
    topK: number;
    modelType: string;
    [key: string]: any;
  };
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface CheckupRun {
  id: string;
  modelVersionId: string;
  modelName: string;
  version: string;
  batchName: string;
  name: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
  operator: string;
  confidenceThreshold: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    manualOverrideRate: number;
    totalSamples: number;
    totalCount: number;
    conflictCount: number;
  };
  dataHash: string;
}

export interface Sample {
  id: string;
  question: string;
  sourceFile: string;
  sourceLine: number;
  knowledgeSource: string;
  referenceAnswer?: string;
  modelOutput?: string;
  manualCorrection?: string;
  onlineFeedback?: string;
  originalData: Record<string, any>;
  importedAt: string;
  importedBy: string;
  dataHash: string;
}

export interface Evidence {
  id: string;
  knowledgeDocId: string;
  fragment: string;
  startPos: number;
  endPos: number;
  relevanceScore: number;
  quotedText: string;
}

export interface ManualJudgment {
  id: string;
  sampleResultId: string;
  originalJudgment: JudgmentType;
  newJudgment: JudgmentType;
  judgment: JudgmentType;
  reason: string;
  createdAt: string;
  createdBy: string;
  operator: string;
  timestamp: string;
}

export interface Note {
  id: string;
  entityType: EntityType;
  entityId: string;
  content: string;
  diffSummary?: string;
  createdAt: string;
  createdBy: string;
  operator: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  createdAt: string;
  createdBy: string;
  operator: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SampleResult {
  id: string;
  checkupRunId: string;
  runId: string;
  sampleId: string;
  modelOutput: string;
  confidence: number;
  modelConfidence: number;
  thresholdUsed: number;
  judgment: JudgmentType;
  originalJudgment: JudgmentType;
  finalJudgment: JudgmentType;
  status: ResultStatus;
  evidences: Evidence[];
  evidence: Evidence[];
  manualJudgment?: ManualJudgment;
  notes: Note[];
  processedAt: string;
}

export interface MetricComparison {
  metrics: {
    name: string;
    values: { runId: string; value: number; change?: number }[];
  }[];
}

export interface SampleDifference {
  sampleId: string;
  question: string;
  differences: {
    runId: string;
    judgment: JudgmentType;
    confidence: number;
  }[];
}

export interface ComparisonResult {
  run1: CheckupRun;
  run2: CheckupRun;
  metricChanges: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
  };
  sampleDifferences: SampleDifference[];
}

export interface ConflictItem {
  sampleResultId: string;
  sampleId: string;
  question: string;
  runId1: string;
  runId2: string;
  judgment1: JudgmentType;
  judgment2: JudgmentType;
  confidence1?: number;
  confidence2?: number;
  type: string;
  description: string;
  evidences: Evidence[];
  createdAt: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolvedNote?: string;
  modelJudgment: JudgmentType;
  manualJudgment: JudgmentType;
  reason: string;
}

export interface ImportSampleInput {
  question: string;
  reference_answer?: string;
  model_output?: string;
  manual_correction?: string;
  online_feedback?: string;
  knowledge_source: string;
  original_data?: Record<string, any>;
}

export interface CreateCheckupOptions {
  name?: string;
  sampleIds: string[];
  modelVersionId: string;
}

export interface ExperimentBatch {
  id: string;
  materialId: string;
  studentId: string;
  studentName: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'needs_review';
  version: number;
  parentBatchId?: string;
}

export interface SensorLog {
  id: string;
  batchId: string;
  timestamp: string;
  temperature: number | null;
  sphereDiameter: number | null;
  fallTime: number | null;
  fallDistance: number | null;
  rawData: Record<string, any> | null;
}

export interface ExperimentRecord {
  id: string;
  batchId: string;
  timestamp: string;
  type: 'submission' | 'revision' | 'note';
  content: string;
  author: string;
}

export interface Correction {
  id: string;
  batchId: string;
  timestamp: string;
  content: string;
  author: string;
  category: 'praise' | 'suggestion' | 'error' | 'deduction';
  points?: number;
}

export interface ManualConfirmation {
  id: string;
  batchId: string;
  timestamp: string;
  content: string;
  confirmer: string;
  relatedItemId?: string;
  relatedItemType?: 'viscosity_estimate' | 'correction' | 'sensor_log';
}

export interface JudgmentStep {
  step: string;
  value: number;
  threshold: number;
  passed: boolean;
}

export interface ViscosityEstimate {
  id: string;
  batchId: string;
  timestamp: string;
  viscosity: number | null;
  unit: string;
  judgment: 'pass' | 'fail' | 'borderline' | 'insufficient_data';
  judgmentReason: string;
  judgmentSteps: JudgmentStep[];
  nextSteps: string[];
  rawCalculation: Record<string, any>;
  algorithmVersion: string;
}

export interface GradingItem {
  name: string;
  score: number;
  maxScore: number;
  evidenceIds: string[];
  comment: string;
}

export interface GradingSheet {
  id: string;
  batchId: string;
  createdAt: string;
  totalScore: number;
  maxScore: number;
  items: GradingItem[];
  finalComment: string;
}

export type TimelineEventType =
  | 'sensor_log'
  | 'experiment_record'
  | 'correction'
  | 'manual_confirmation'
  | 'viscosity_estimate';

export interface TimelineEvent {
  id: string;
  batchId: string;
  timestamp: string;
  type: TimelineEventType;
  data: SensorLog | ExperimentRecord | Correction | ManualConfirmation | ViscosityEstimate;
}

export interface CreateBatchRequest {
  materialId: string;
  studentId: string;
  studentName: string;
  sensorLogs?: Omit<SensorLog, 'id' | 'batchId'>[];
  experimentRecords?: Omit<ExperimentRecord, 'id' | 'batchId'>[];
}

export interface CreateCorrectionRequest {
  content: string;
  author: string;
  category: Correction['category'];
  points?: number;
}

export interface CreateConfirmationRequest {
  content: string;
  confirmer: string;
  relatedItemId?: string;
  relatedItemType?: ManualConfirmation['relatedItemType'];
}

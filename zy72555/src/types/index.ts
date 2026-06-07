export type LogStatus = 'pending' | 'reviewing' | 'confirmed' | 'rejected';

export type OperationType = 'create' | 'update' | 'import' | 'rollback';

export type EntityType = 'training_log' | 'threshold_note';

export interface TrainingLog {
  id: string;
  originalLineNumber: number;
  fileHash: string;
  fileName: string;
  epoch: number;
  reward: number;
  loss: number;
  minorityMetric: number;
  overallMetric: number;
  status: LogStatus;
  isBoundaryCase: boolean;
  boundaryReason?: string;
  remark: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThresholdNote {
  id: string;
  trainingLogIds: string[];
  content: string;
  isLateArrival: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ChangeHistory {
  id: string;
  entityType: EntityType;
  entityId: string;
  beforeSnapshot: Record<string, any>;
  afterSnapshot: Record<string, any>;
  changedFields: string[];
  operationType: OperationType;
  operator: string;
  operatedAt: string;
}

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  codeReference: string;
  rollbackSteps: string[];
}

export interface ImportReport {
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  skippedRows: number;
  boundaryCases: number;
}

export type WorkflowStep = 'import' | 'review' | 'replay';

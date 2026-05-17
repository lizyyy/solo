export enum AdjustmentStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  RESTORING = 'restoring',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum PriorityLevel {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  URGENT = 10
}

export interface QueueAdjustment {
  id: string;
  idempotencyKey: string;
  queueName: string;
  originalPriority: PriorityLevel;
  targetPriority: PriorityLevel;
  reason: string;
  status: AdjustmentStatus;
  recoveryCondition: string;
  scheduledAt: Date;
  activatedAt?: Date;
  restoredAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  report?: AdjustmentReport;
}

export interface AffectedTask {
  id: string;
  adjustmentId: string;
  taskId: string;
  taskType: string;
  originalPriority: PriorityLevel;
  adjustedPriority: PriorityLevel;
  affectedAt: Date;
  recoveredAt?: Date;
  metadata: Record<string, any>;
}

export interface FailureRecord {
  id: string;
  adjustmentId: string;
  operation: string;
  originalInput: Record<string, any>;
  processingBasis: string;
  errorMessage: string;
  errorStack?: string;
  finalConclusion?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface AdjustmentReport {
  totalAffectedTasks: number;
  peakConcurrency: number;
  avgProcessingTime: number;
  taskDistribution: Record<string, number>;
  summary: string;
  generatedAt: Date;
}

export interface CreateAdjustmentRequest {
  idempotencyKey: string;
  queueName: string;
  targetPriority: PriorityLevel;
  reason: string;
  recoveryCondition: string;
  scheduledAt?: Date;
  createdBy: string;
}

export interface ManualCorrectionRequest {
  adjustmentId: string;
  newPriority?: PriorityLevel;
  newRecoveryCondition?: string;
  reason: string;
  correctedBy: string;
}

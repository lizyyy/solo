export enum CanaryStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  BLOCKED = 'blocked',
  REVOKED = 'revoked',
  COMPENSATED = 'compensated'
}

export enum TransitionType {
  CONFIRM = 'confirm',
  BLOCK = 'block',
  REVOKE = 'revoke',
  COMPENSATE = 'compensate'
}

export interface Consumer {
  id: string;
  name: string;
  confirmedAt?: Date;
  confirmedBy?: string;
}

export interface RevocationRecord {
  id: string;
  reason: string;
  revokedBy: string;
  revokedAt: Date;
  originalStatus: CanaryStatus;
}

export interface FailureRecord {
  step: string;
  originalInput: unknown;
  processingBasis: string;
  finalConclusion: string;
  failedAt: Date;
  error?: string;
}

export interface CompatibilityIssue {
  type: 'breaking' | 'warning';
  field: string;
  message: string;
}

export interface SchemaCanary {
  id: string;
  schemaName: string;
  schemaVersion: string;
  schemaContent: string;
  consumers: Consumer[];
  canaryRatio: number;
  status: CanaryStatus;
  statusHistory: Array<{
    status: CanaryStatus;
    changedAt: Date;
    changedBy?: string;
    reason?: string;
  }>;
  revocationRecords: RevocationRecord[];
  failureRecords: FailureRecord[];
  compatibilityIssues: CompatibilityIssue[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateCanaryRequest {
  schemaName: string;
  schemaVersion: string;
  schemaContent: string;
  consumerIds: string[];
  canaryRatio: number;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface StatusTransitionRequest {
  transitionType: TransitionType;
  reason: string;
  operatedBy: string;
  consumerId?: string;
}

export interface ManualCorrectionRequest {
  status?: CanaryStatus;
  canaryRatio?: number;
  consumers?: Consumer[];
  correctedBy: string;
  correctionReason: string;
}
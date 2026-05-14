export enum SampleSource {
  SYSTEM = 'system',
  MANUAL = 'manual',
  MIXED = 'mixed',
  API = 'api'
}

export enum SampleStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  NEEDS_REVIEW = 'needs_review',
  MANUALLY_ADJUSTED = 'manually_adjusted'
}

export interface LiveSample {
  id: string;
  batchId: string;
  productId: string;
  productName: string;
  source: SampleSource;
  status: SampleStatus;
  liveDate: string;
  streamerId: string;
  streamerName: string;
  createdAt: string;
  updatedAt: string;
  remarks?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  adjustmentReason?: string;
}

export interface Batch {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  totalSamples: number;
  status: 'active' | 'cancelled' | 'completed';
}

export interface TaskPreview {
  batchId: string;
  affectedCount: number;
  safeToCancel: number;
  riskyCount: number;
  riskySamples: RiskySample[];
  estimatedDuration: string;
}

export interface RiskySample {
  sampleId: string;
  productName: string;
  reason: string;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface CancellationResult {
  success: boolean;
  batchId: string;
  totalProcessed: number;
  successfullyCancelled: number;
  failedCount: number;
  failedSamples: FailedSample[];
  completedAt: string;
}

export interface FailedSample {
  sampleId: string;
  productName: string;
  error: string;
  source: SampleSource;
  status: SampleStatus;
}

export interface ManualAdjustment {
  id: string;
  sampleId: string;
  batchId: string;
  adjustedBy: string;
  adjustedAt: string;
  oldStatus: SampleStatus;
  newStatus: SampleStatus;
  reason: string;
  remarks: string;
}
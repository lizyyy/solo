export enum ReviewStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  REVIEWED = 'reviewed',
  REVISED = 'revised',
  CANCELLED = 'cancelled'
}

export enum ScoreChangeType {
  INCREASE = 'increase',
  DECREASE = 'decrease',
  NO_CHANGE = 'no_change'
}

export interface EvaluationSample {
  sampleId: string;
  batchId: string;
  content: string;
  originalScore: number;
  currentScore: number;
  modelOutput: string;
  expectedOutput?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewRecord {
  reviewId: string;
  sampleId: string;
  batchId: string;
  reviewerId: string;
  reviewerName: string;
  reviewOpinion: string;
  revisedScore?: number;
  scoreChangeType?: ScoreChangeType;
  scoreDifference?: number;
  status: ReviewStatus;
  rawInput?: any;
  processingBasis?: string;
  exceptionMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationBatch {
  batchId: string;
  batchName: string;
  modelName: string;
  evaluationType: string;
  totalSamples: number;
  reviewedCount: number;
  revisedCount: number;
  averageOriginalScore: number;
  averageRevisedScore: number;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ReviewReport {
  reportId: string;
  batchId: string;
  generatedAt: Date;
  generatedBy: string;
  summary: {
    totalSamples: number;
    reviewedCount: number;
    revisedCount: number;
    pendingCount: number;
    averageOriginalScore: number;
    averageRevisedScore: number;
    scoreChangeRate: number;
  };
  details: Array<{
    sampleId: string;
    originalScore: number;
    revisedScore: number;
    scoreDifference: number;
    reviewer: string;
    reviewOpinion: string;
    reviewTime: Date;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

import { v4 as uuidv4 } from 'uuid';

export type RepairStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';
export type RatingSource = 'student' | 'system' | 'manual';
export type DiscrepancyType = 'duplicate_repair' | 'timeout_penalty' | 'malicious_rating' | 'mismatch' | 'missing_data';
export type ReviewDecision = 'approved' | 'rejected' | 'supplement_required' | 'pending';
export type AppealStatus = 'pending' | 'upheld' | 'overruled';

export interface RepairRecord {
  id: string;
  repairNo: string;
  studentId: string;
  studentName: string;
  location: string;
  description: string;
  category: string;
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  status: RepairStatus;
  workerId?: string;
  expectedCompletionTime?: number;
  importBatchId: string;
}

export interface Worker {
  id: string;
  workerNo: string;
  name: string;
  phone: string;
  specialty: string[];
  baseScore: number;
  currentScore: number;
  importBatchId: string;
}

export interface RatingRecord {
  id: string;
  repairNo: string;
  workerId: string;
  score: number;
  maxScore: number;
  source: RatingSource;
  reason?: string;
  ratedBy?: string;
  ratedAt: string;
  isAppealed: boolean;
  appealStatus?: AppealStatus;
  importBatchId: string;
}

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high';
  repairNo?: string;
  workerId?: string;
  ratingId?: string;
  description: string;
  evidence: string[];
  relatedRecordIds: string[];
  autoDetected: boolean;
  detectedAt: string;
}

export interface ReviewRecord {
  id: string;
  discrepancyId: string;
  decision: ReviewDecision;
  reviewer: string;
  comment: string;
  reviewedAt: string;
  scoreAdjustment?: number;
  adjustmentReason?: string;
}

export interface AppealHistory {
  id: string;
  ratingId: string;
  repairNo: string;
  workerId: string;
  originalScore: number;
  appealedScore?: number;
  finalScore: number;
  appellant: string;
  appellantRole: 'worker' | 'student' | 'admin';
  appealReason: string;
  evidence: string[];
  status: AppealStatus;
  reviewer?: string;
  reviewComment?: string;
  reviewedAt?: string;
  createdAt: string;
  relatedDiscrepancyIds: string[];
}

export interface ReconciliationBatch {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  repairImportId?: string;
  workerImportId?: string;
  ratingImportId?: string;
  status: 'importing' | 'matching' | 'reviewing' | 'completed';
  statistics: BatchStatistics;
}

export interface BatchStatistics {
  totalRepairs: number;
  totalWorkers: number;
  totalRatings: number;
  matchedRepairs: number;
  unmatchedRepairs: number;
  discrepancies: number;
  discrepanciesByType: Record<DiscrepancyType, number>;
  pendingReviews: number;
  completedReviews: number;
  averageScore: number;
  totalScoreDeductions: number;
}

export interface ReportData {
  batchId: string;
  generatedAt: string;
  summary: BatchStatistics;
  discrepancies: Discrepancy[];
  reviews: ReviewRecord[];
  appeals: AppealHistory[];
  workerScores: Array<{
    workerId: string;
    workerName: string;
    originalScore: number;
    adjustedScore: number;
    totalDeductions: number;
    deductionDetails: Array<{ reason: string; amount: number }>;
  }>;
}

export const createId = (): string => uuidv4();

export interface TrainingSubmission {
  id: string;
  department: string;
  courseName: string;
  courseCode: string;
  traineeName: string;
  traineeId: string;
  submitTime: string;
  status: SubmissionStatus;
  completionRate: number;
  quizScore: number | null;
  practicalScore: number | null;
  totalScore: number | null;
  earlyTermination: boolean;
  terminationReason?: string;
  attachments: SubmissionAttachment[];
  auditTrail: AuditRecord[];
}

export type SubmissionStatus = 
  | 'draft' 
  | 'submitted' 
  | 'under_review' 
  | 'intercepted' 
  | 'approved' 
  | 'rejected' 
  | 'early_terminated';

export interface SubmissionAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadTime: string;
}

export interface AuditRecord {
  id: string;
  action: string;
  operator: string;
  operatorId: string;
  timestamp: string;
  remarks?: string;
  fromStatus?: SubmissionStatus;
  toStatus?: SubmissionStatus;
}

export interface InterceptionReason {
  code: string;
  category: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface AuditResult {
  submissionId: string;
  submission: TrainingSubmission;
  isIntercepted: boolean;
  interceptionReasons: InterceptionReason[];
  beforeStatus: SubmissionStatus;
  afterStatus: SubmissionStatus;
  processingTime: number;
  nextSteps: string[];
  reviewOpinions: ReviewOpinion[];
  candidateCleanupList: CleanupCandidate[];
}

export interface ReviewOpinion {
  id: string;
  reviewer: string;
  reviewerId: string;
  timestamp: string;
  opinion: 'agree' | 'disagree' | 'need_more_info';
  comments: string;
  originalRecordReference: string;
}

export interface CleanupCandidate {
  id: string;
  type: 'submission' | 'attachment' | 'audit_record';
  description: string;
  reason: string;
  riskLevel: 'safe' | 'caution' | 'high_risk';
}

export interface AuditReport {
  reportId: string;
  generatedAt: string;
  totalProcessed: number;
  interceptedCount: number;
  approvedCount: number;
  results: AuditResult[];
  summary: {
    totalProcessingTime: number;
    averageProcessingTime: number;
    topInterceptionReasons: { reason: string; count: number }[];
  };
}

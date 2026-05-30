export type QuestionType = 'interval' | 'rhythm' | 'melody';

export type SubmissionStatus = 'pending' | 'graded' | 'reviewed' | 'conflict';

export type DetectionType = 'enharmonic_mismatch' | 'type_mismatch' | 'duplicate_submission';

export interface Class {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  classId: string;
  name: string;
  studentNo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  practiceDate: string;
  type: QuestionType;
  questionNo: number;
  standardAnswer: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerSubmission {
  id: string;
  studentId: string;
  questionId: string;
  studentAnswer: string;
  practiceDate: string;
  submittedAt: string;
  gradedAt?: string;
  isCorrect?: boolean;
  score?: number;
  status: SubmissionStatus;
  idempotencyKey: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  entityType: 'submission' | 'question' | 'student' | 'class' | 'report';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'supplement' | 'grade';
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  operator?: string;
  timestamp: string;
  description: string;
}

export interface DetectionIssue {
  id: string;
  type: DetectionType;
  submissionId?: string;
  questionId?: string;
  description: string;
  details: Record<string, any>;
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface ReportAttachment {
  id: string;
  reportId: string;
  fileName: string;
  fileType: string;
  fileData: string;
  uploadedAt: string;
}

export interface GradeResult {
  submissionId: string;
  isCorrect: boolean;
  score: number;
  feedback?: string;
  issues: DetectionIssue[];
}

export interface ClassStatistics {
  classId: string;
  className: string;
  practiceDate: string;
  totalStudents: number;
  submittedCount: number;
  averageScore: number;
  intervalStats: TypeStats;
  rhythmStats: TypeStats;
  melodyStats: TypeStats;
}

export interface TypeStats {
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  averageScore: number;
}

export interface SupplementData {
  entityType: 'submission' | 'question' | 'student' | 'class' | 'report';
  entityId: string;
  fieldName: string;
  value: string;
  operator?: string;
}

export interface ImportResult {
  type: 'created' | 'updated' | 'duplicate' | 'conflict';
  entityId: string;
  message: string;
  conflicts?: string[];
}

export interface ManualCounterExample {
  id: string;
  sampleId: string;
  timestamp: Date;
  windowNumber: number;
  arrivalCount: number;
  serviceTime: number;
  waitTime: number;
  isNegative: boolean;
  source: 'manual' | 'old_table' | 'calculated';
  notes?: string;
  mainProcessEvidence?: string;
}

export interface QuestionnaireRow {
  id: string;
  sampleId: string;
  timestamp: Date;
  windowNumber: number;
  onSiteStatement: string;
  witnessName: string;
  hasBreak: boolean;
  breakStartTime?: string;
  breakEndTime?: string;
  isTemporaryClosed: boolean;
  queueOverflow: boolean;
  actualWaitTime: number;
  actualArrivalCount: number;
  supplementaryNotes?: string;
}

export interface WindowConfig {
  windowNumber: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
  hasLunchBreak: boolean;
  lunchStartTime?: string;
  lunchEndTime?: string;
}

export interface NegativeSample {
  sampleId: string;
  detectedAt: Date;
  detectedBy: 'old_table' | 'system' | 'ta_review' | 'coach_review';
  reason: string;
  value: number;
  isMarkedAsMissing: boolean;
  sourceLink: {
    manualCounterExampleId?: string;
    questionnaireRowId?: string;
  };
}

export type ReviewStatus = 'pending_ta' | 'ta_verified' | 'pending_coach' | 'coach_verified' | 'resolved' | 'dismissed';

export type NextAction = 'find_ta' | 'find_coach' | 'collect_more_data' | 'resolve' | 'dismiss';

export type ReviewErrorKind =
  | 'sample_not_found'
  | 'invalid_status_transition'
  | 'missing_materials'
  | 'already_handled'
  | 'validation_error';

export interface ReviewResult {
  success: boolean;
  sample?: BoundarySample;
  errorKind?: ReviewErrorKind;
  errorMessage?: string;
  allowedActions?: ReviewStatus[];
  hints?: string[];
}

export interface ReviewLogEntry {
  id: string;
  timestamp: Date;
  action:
    | 'detected'
    | 'created'
    | 'ta_review'
    | 'coach_review'
    | 'supplement'
    | 'dismissed'
    | 'resolved'
    | 'reopened';
  operator: string;
  statusBefore?: ReviewStatus;
  statusAfter?: ReviewStatus;
  originalWaitTime?: number;
  correctedWaitTime?: number;
  originalArrivalCount?: number;
  correctedArrivalCount?: number;
  reason?: string;
  notes?: string;
  rawStatementAdded?: boolean;
}

export interface BoundarySample {
  sampleId: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  negativeSample: NegativeSample;
  manualCounterExample?: ManualCounterExample;
  questionnaireRow?: QuestionnaireRow;
  whyKept: string;
  missingMaterials: string[];
  nextAction: NextAction;
  assignee?: string;
  taReviewNotes?: string;
  coachReviewNotes?: string;
  originalNegativeValues: {
    waitTime?: number;
    arrivalCount?: number;
  };
  reviewLog: ReviewLogEntry[];
  rawOriginalStatement?: string;
  dataResolution?: {
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
    finalWaitTime?: number;
    finalArrivalCount?: number;
    resolutionReason?: string;
    nextContactPerson?: string;
  };
}

export interface QueueCalculationResult {
  sampleId: string;
  windowNumber: number;
  timestamp: Date;
  arrivalRate: number;
  serviceRate: number;
  averageWaitTime: number;
  actualWaitTime: number;
  queueLength: number;
  isOverflow: boolean;
  factors: {
    lunchBreakImpact: number;
    temporaryClosureImpact: number;
    queueOverflowImpact: number;
  };
}

export interface BoundaryReport {
  reportId: string;
  generatedAt: Date;
  boundarySamples: BoundarySample[];
  statistics: {
    total: number;
    pendingTa: number;
    pendingCoach: number;
    verified: number;
    resolved: number;
  };
}

export type DisplayMode = 'table' | 'chart' | '3d';

export interface AppState {
  manualCounterExamples: Map<string, ManualCounterExample>;
  questionnaireRows: Map<string, QuestionnaireRow>;
  boundarySamples: Map<string, BoundarySample>;
  windowConfigs: WindowConfig[];
}

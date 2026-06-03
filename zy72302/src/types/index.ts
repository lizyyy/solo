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

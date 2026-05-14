export enum LogSource {
  WORKFLOW_SYSTEM = 'workflow_system',
  APPROVAL_PORTAL = 'approval_portal',
  EMAIL_SYSTEM = 'email_system',
  TICKET_SYSTEM = 'ticket_system',
  HR_SYSTEM = 'hr_system',
  SECURITY_AUDIT = 'security_audit'
}

export enum LogEventType {
  SUBMIT = 'submit',
  ASSIGN = 'assign',
  APPROVE = 'approve',
  REJECT = 'reject',
  REASSIGN = 'reassign',
  ESCALATE = 'escalate',
  COMMENT = 'comment',
  REMIND = 'remind',
  TIMEOUT = 'timeout',
  WITHDRAW = 'withdraw',
  UPDATE = 'update',
  COMPLETE = 'complete'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
  ESCALATED = 'escalated',
  WITHDRAWN = 'withdrawn'
}

export enum BlockReason {
  MISSING_APPROVAL_COMMENT = 'missing_approval_comment',
  INVALID_APPROVER = 'invalid_approver',
  EXPIRED_DEADLINE = 'expired_deadline',
  POLICY_VIOLATION = 'policy_violation',
  INCOMPLETE_DOCUMENTS = 'incomplete_documents',
  CONFLICTING_PRE_APPROVAL = 'conflicting_pre_approval'
}

export interface ApprovalLog {
  id: string;
  batchId: string;
  source: LogSource;
  eventType: LogEventType;
  timestamp: Date;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  targetApproverId?: string;
  targetApproverName?: string;
  comment?: string;
  approvalComment?: string;
  metadata: Record<string, any>;
  rawContent: string;
}

export interface ApprovalTicket {
  ticketId: string;
  batchId: string;
  requestId: string;
  requestType: string;
  requesterId: string;
  requesterName: string;
  requesterDepartment: string;
  requestTitle: string;
  requestDescription: string;
  requestedAt: Date;
  expectedCompletionAt?: Date;
  currentStatus: ApprovalStatus;
  currentApprover?: string;
  approvalChain: string[];
  completedApprovals: string[];
  attachedDocuments: string[];
  escalationLevel: number;
  relatedTicketIds: string[];
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  eventType: LogEventType;
  source: LogSource;
  actor: {
    id: string;
    name: string;
    role: string;
  };
  action: string;
  details: string;
  comment?: string;
  approvalComment?: string;
  rawLog: ApprovalLog;
}

export interface ApprovalTimeline {
  batchId: string;
  ticketId: string;
  events: TimelineEvent[];
  startTime: Date;
  endTime?: Date;
  totalDurationMs?: number;
}

export interface ApprovalRule {
  id: string;
  version: string;
  name: string;
  description: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  failureExplanation: string;
  nextStepSuggestion: string;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than';
  value: any;
}

export interface RuleAction {
  type: 'block' | 'warn' | 'escalate' | 'request_info';
  target?: string;
  message: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleVersion: string;
  ruleName: string;
  passed: boolean;
  failureExplanation?: string;
  nextStepSuggestion?: string;
  evaluatedAt: Date;
}

export interface ProcessingResult {
  batchId: string;
  ticketId: string;
  processedAt: Date;
  processingDurationMs: number;
  originalStatus: ApprovalStatus;
  finalStatus: ApprovalStatus;
  timeline: ApprovalTimeline;
  ruleResults: RuleEvaluationResult[];
  blockReasons: BlockReason[];
  blockExplanations: string[];
  isDuplicate: boolean;
  duplicateOfBatchId?: string;
  hasConflicts: boolean;
  conflictDetails?: string[];
  nextSteps: string[];
  reviewNotes?: string;
  relatedTicketReferences?: string[];
  ruleSnapshotVersion: string;
}

export interface ProcessingReport {
  reportId: string;
  generatedAt: Date;
  totalBatches: number;
  successfulBatches: number;
  blockedBatches: number;
  duplicateBatches: number;
  totalProcessingTimeMs: number;
  results: ProcessingResult[];
  comparisons: {
    batchId: string;
    before: {
      status: ApprovalStatus;
      eventCount: number;
    };
    after: {
      status: ApprovalStatus;
      eventCount: number;
      blockReasons: BlockReason[];
    };
  }[];
  overallNextSteps: string[];
}

export interface ReviewRecord {
  id: string;
  batchId: string;
  reviewerId: string;
  reviewerName: string;
  reviewedAt: Date;
  reviewComment: string;
  reviewDecision: 'uphold' | 'override' | 'escalate';
  overrideReason?: string;
  escalationTicketId?: string;
  originalResultId: string;
}

const ProbationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  AWAITING_EVALUATION: 'awaiting_evaluation',
  EVALUATION_COMPLETED: 'evaluation_completed',
  AWAITING_APPROVAL: 'awaiting_approval',
  EXTENSION_REQUESTED: 'extension_requested',
  EXTENSION_APPROVED: 'extension_approved',
  EXTENSION_REJECTED: 'extension_rejected',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONFIRMED: 'confirmed',
  TERMINATED: 'terminated'
};

const EvaluationStatus = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const MentorFeedbackStatus = {
  PENDING: 'pending',
  SUBMITTED: 'submitted'
};

const SalaryAdjustmentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  EFFECTIVE: 'effective',
  REJECTED: 'rejected'
};

const ApprovalResult = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review'
};

const ProbationRules = {
  MIN_PERFORMANCE_SCORE: 3.0,
  MAX_EXTENSION_MONTHS: 3,
  MAX_EXTENSION_COUNT: 1,
  MIN_MENTOR_FEEDBACK_SCORE: 3.0,
  AUTO_CONFIRM_DAYS_AFTER_APPROVAL: 0
};

const RuleCheckResult = {
  PASS: 'pass',
  FAIL: 'fail',
  NEEDS_REVIEW: 'needs_review'
};

const TaskType = {
  SALARY_EFFECT: 'salary_effect',
  STATUS_UPDATE: 'status_update'
};

module.exports = {
  ProbationStatus,
  EvaluationStatus,
  MentorFeedbackStatus,
  SalaryAdjustmentStatus,
  ApprovalResult,
  ProbationRules,
  RuleCheckResult,
  TaskType
};

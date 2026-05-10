exports.FILE_TASK_STATUS = {
  PENDING: 'pending',
  SCANNING: 'scanning',
  SAFE: 'safe',
  QUARANTINED: 'quarantined',
  REVIEWING: 'reviewing',
  UNQUARANTINED: 'unquarantined'
};

exports.AUDIT_ACTION = {
  TASK_CREATED: 'task_created',
  SCAN_STARTED: 'scan_started',
  SCAN_COMPLETED_SAFE: 'scan_completed_safe',
  SCAN_COMPLETED_THREAT: 'scan_completed_threat',
  DOWNLOAD_ATTEMPT: 'download_attempt',
  DOWNLOAD_BLOCKED: 'download_blocked',
  DOWNLOAD_ALLOWED: 'download_allowed',
  FALSE_POSITIVE_REQUESTED: 'false_positive_requested',
  FALSE_POSITIVE_APPROVED: 'false_positive_approved',
  FALSE_POSITIVE_REJECTED: 'false_positive_rejected',
  RULE_EVALUATED: 'rule_evaluated'
};

exports.DOWNLOAD_PERMISSION = {
  ALLOWED: 'allowed',
  BLOCKED: 'blocked',
  REQUIRES_REVIEW: 'requires_review'
};

const REPLAY_STATES = {
  PENDING: 'pending',
  VALIDATING: 'validating',
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const BATCH_STATES = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  DESENSITIZING: 'desensitizing',
  READY: 'ready',
  REPLAYING: 'replaying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ARCHIVED: 'archived'
};

const VALIDATION_STATES = {
  PENDING: 'pending',
  VALID: 'valid',
  INVALID: 'invalid',
  NEEDS_REVIEW: 'needs_review'
};

const EXCEPTION_STATES = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed'
};

const CORRECTION_APPROVAL_STATES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const REVIEW_STATES = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  FINALIZED: 'finalized'
};

const INTERCEPTION_STATUS = {
  INTERCEPTED: 'intercepted',
  ALLOWED: 'allowed',
  BLOCKED: 'blocked',
  REDIRECTED: 'redirected'
};

const DESENSITIZATION_RULES = {
  MASK_PHONE: 'mask_phone',
  MASK_EMAIL: 'mask_email',
  MASK_ID_CARD: 'mask_id_card',
  MASK_NAME: 'mask_name',
  MASK_ADDRESS: 'mask_address',
  HASH_IP: 'hash_ip',
  REMOVE_SENSITIVE_FIELDS: 'remove_sensitive_fields'
};

module.exports = {
  REPLAY_STATES,
  BATCH_STATES,
  VALIDATION_STATES,
  EXCEPTION_STATES,
  CORRECTION_APPROVAL_STATES,
  REVIEW_STATES,
  INTERCEPTION_STATUS,
  DESENSITIZATION_RULES
};

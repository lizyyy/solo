const APPEAL_STATUSES = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ESCALATED: 'escalated'
};

const CONTENT_STATUSES = {
  BLOCKED: 'blocked',
  APPEALED: 'appealed',
  RESTORED: 'restored',
  PERMANENT_BLOCKED: 'permanent_blocked'
};

const AUDIT_ACTIONS = {
  CREATE: 'create',
  SUBMIT: 'submit',
  ASSIGN: 'assign',
  APPROVE: 'approve',
  REJECT: 'reject',
  ESCALATE: 'escalate',
  COMMENT: 'comment',
  SYNC: 'sync'
};

const DISPOSAL_TYPES = {
  RESTORE: 'restore',
  MAINTAIN_BLOCK: 'maintain_block',
  DELETE: 'delete',
  WARN: 'warn'
};

module.exports = {
  APPEAL_STATUSES,
  CONTENT_STATUSES,
  AUDIT_ACTIONS,
  DISPOSAL_TYPES
};

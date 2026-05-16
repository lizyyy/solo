const FREEZE_STATUS = {
  PENDING_REVIEW: 'pending_review',
  CONFIRMED: 'confirmed',
  IN_INVESTIGATION: 'in_investigation',
  PENDING_THAW_APPROVAL: 'pending_thaw_approval',
  THAWED: 'thawed',
  PARTIALLY_THAWED: 'partially_thawed',
  CORRECTED: 'corrected',
  CANCELLED: 'cancelled'
};

const STATUS_TRANSITIONS = {
  [FREEZE_STATUS.PENDING_REVIEW]: [
    FREEZE_STATUS.CONFIRMED,
    FREEZE_STATUS.CANCELLED
  ],
  [FREEZE_STATUS.CONFIRMED]: [
    FREEZE_STATUS.IN_INVESTIGATION,
    FREEZE_STATUS.PENDING_THAW_APPROVAL,
    FREEZE_STATUS.CANCELLED
  ],
  [FREEZE_STATUS.IN_INVESTIGATION]: [
    FREEZE_STATUS.PENDING_THAW_APPROVAL,
    FREEZE_STATUS.CORRECTED,
    FREEZE_STATUS.CANCELLED
  ],
  [FREEZE_STATUS.PENDING_THAW_APPROVAL]: [
    FREEZE_STATUS.THAWED,
    FREEZE_STATUS.PARTIALLY_THAWED,
    FREEZE_STATUS.CANCELLED
  ],
  [FREEZE_STATUS.PARTIALLY_THAWED]: [
    FREEZE_STATUS.PENDING_THAW_APPROVAL,
    FREEZE_STATUS.THAWED
  ],
  [FREEZE_STATUS.THAWED]: [],
  [FREEZE_STATUS.CORRECTED]: [],
  [FREEZE_STATUS.CANCELLED]: []
};

const FREEZE_CATEGORIES = {
  ABNORMAL_USAGE: 'abnormal_usage',
  CUSTOMER_COMPLAINT: 'customer_complaint',
  BUDGET_EXCEEDED: 'budget_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  SYSTEM_ERROR: 'system_error',
  OTHER: 'other'
};

const CORRECTION_TYPES = {
  BUDGET_ADJUSTMENT: 'budget_adjustment',
  USAGE_CORRECTION: 'usage_correction',
  FREEZE_AMOUNT_ADJUSTMENT: 'freeze_amount_adjustment',
  OTHER: 'other'
};

function canTransition(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions && allowedTransitions.includes(toStatus);
}

function getTerminalStatuses() {
  return [
    FREEZE_STATUS.THAWED,
    FREEZE_STATUS.CORRECTED,
    FREEZE_STATUS.CANCELLED
  ];
}

function isTerminalStatus(status) {
  return getTerminalStatuses().includes(status);
}

module.exports = {
  FREEZE_STATUS,
  STATUS_TRANSITIONS,
  FREEZE_CATEGORIES,
  CORRECTION_TYPES,
  canTransition,
  isTerminalStatus
};

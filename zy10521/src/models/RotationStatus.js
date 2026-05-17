const ROTATION_STATUS = {
  PENDING: 'pending',
  CONFIRMING: 'confirming',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
  EXCEPTION: 'exception'
};

const ROTATION_STATES = {
  [ROTATION_STATUS.PENDING]: {
    next: [ROTATION_STATUS.CONFIRMING, ROTATION_STATUS.REJECTED],
    allowedActions: ['start_confirm', 'reject']
  },
  [ROTATION_STATUS.CONFIRMING]: {
    next: [ROTATION_STATUS.IN_PROGRESS, ROTATION_STATUS.REJECTED, ROTATION_STATUS.EXPIRED],
    allowedActions: ['confirm', 'reject', 'mark_expired']
  },
  [ROTATION_STATUS.IN_PROGRESS]: {
    next: [ROTATION_STATUS.COMPLETED, ROTATION_STATUS.EXCEPTION],
    allowedActions: ['complete', 'mark_exception']
  },
  [ROTATION_STATUS.COMPLETED]: {
    next: [],
    allowedActions: []
  },
  [ROTATION_STATUS.EXPIRED]: {
    next: [ROTATION_STATUS.CONFIRMING, ROTATION_STATUS.REJECTED],
    allowedActions: ['restart_confirm', 'reject']
  },
  [ROTATION_STATUS.REJECTED]: {
    next: [ROTATION_STATUS.PENDING],
    allowedActions: ['restart']
  },
  [ROTATION_STATUS.EXCEPTION]: {
    next: [ROTATION_STATUS.IN_PROGRESS, ROTATION_STATUS.COMPLETED],
    allowedActions: ['resolve_exception', 'force_complete']
  }
};

function canTransition(currentStatus, nextStatus) {
  return ROTATION_STATES[currentStatus]?.next.includes(nextStatus) || false;
}

module.exports = {
  ROTATION_STATUS,
  ROTATION_STATES,
  canTransition
};

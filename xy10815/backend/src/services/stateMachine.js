const STATUS_TRANSITIONS = {
  PENDING: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'PAUSED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  FAILED: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

const STATUS_FINAL = ['COMPLETED', 'CANCELLED'];

function canTransition(from, to) {
  const allowedTransitions = STATUS_TRANSITIONS[from] || [];
  return allowedTransitions.includes(to);
}

function isFinalStatus(status) {
  return STATUS_FINAL.includes(status);
}

module.exports = {
  STATUS_TRANSITIONS,
  STATUS_FINAL,
  canTransition,
  isFinalStatus
};

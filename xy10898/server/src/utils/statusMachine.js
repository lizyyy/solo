const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'rejected', 'archived'];

const STATUS_TRANSITIONS = {
  pending: ['reviewing', 'archived'],
  reviewing: ['approved', 'rejected', 'pending'],
  approved: ['archived'],
  rejected: ['pending', 'reviewing', 'archived'],
  archived: ['pending']
};

const canTransition = (currentStatus, newStatus) => {
  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

const getAvailableTransitions = (currentStatus) => {
  return STATUS_TRANSITIONS[currentStatus] || [];
};

const isFinalStatus = (status) => {
  return ['archived'].includes(status);
};

const validateStatusChange = (currentStatus, newStatus, action) => {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  
  if (!canTransition(currentStatus, newStatus)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
  }
  
  return true;
};

module.exports = {
  VALID_STATUSES,
  STATUS_TRANSITIONS,
  canTransition,
  getAvailableTransitions,
  isFinalStatus,
  validateStatusChange
};

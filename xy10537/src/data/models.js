const storeModule = require('./store');
const { store, generateId, getTimestamp, addAuditLog, checkIdempotency, setIdempotency } = storeModule;

const SCHEDULE_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CONFLICT: 'conflict',
  NEEDS_REASSIGN: 'needs_reassign',
  REASSIGNED: 'reassigned',
  REJECTED: 'rejected'
};

const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const COMPENSATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid'
};

module.exports = {
  SCHEDULE_STATUS,
  LEAVE_STATUS,
  COMPENSATION_STATUS,
  store,
  generateId,
  getTimestamp,
  addAuditLog,
  checkIdempotency,
  setIdempotency
};

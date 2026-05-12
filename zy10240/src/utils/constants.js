const PLANT_STATUSES = {
  HEALTHY: 'healthy',
  NEEDS_CARE: 'needs_care',
  WILTED: 'wilted',
  DEAD: 'dead',
  REPOTTED: 'repotted',
  MOVED: 'moved'
};

const MAINTENANCE_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NEEDS_REPOTTING: 'needs_repotting',
  NEEDS_COMPENSATION: 'needs_compensation'
};

const COMPENSATION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  WAIVED: 'waived'
};

const RENEWAL_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  BILLED: 'billed'
};

const BILL_STATUSES = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  OVERDUE: 'overdue'
};

module.exports = {
  PLANT_STATUSES,
  MAINTENANCE_STATUSES,
  COMPENSATION_STATUSES,
  RENEWAL_STATUSES,
  BILL_STATUSES
};

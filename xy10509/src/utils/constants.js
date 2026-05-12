const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  URGENT: 'urgent',
  NORMAL: 'normal',
  LOW: 'low'
};

const URGENCY_SCORES = {
  [SEVERITY_LEVELS.CRITICAL]: 100,
  [SEVERITY_LEVELS.URGENT]: 70,
  [SEVERITY_LEVELS.NORMAL]: 40,
  [SEVERITY_LEVELS.LOW]: 10
};

const REQUEST_STATUS = {
  PENDING: 'pending',
  WAITING: 'waiting',
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  TIMED_OUT: 'timed_out',
  REJECTED: 'rejected',
  EXCEPTION: 'exception'
};

const BED_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance'
};

const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  TIMED_OUT: 'timed_out'
};

const EXCEPTION_TYPES = {
  DUPLICATE_REQUEST: 'duplicate_request',
  NO_BED_AVAILABLE: 'no_bed_available',
  CONFIRM_TIMEOUT: 'confirm_timeout',
  DEPARTMENT_INACTIVE: 'department_inactive',
  INVALID_SEVERITY: 'invalid_severity',
  SYSTEM_ERROR: 'system_error'
};

module.exports = {
  SEVERITY_LEVELS,
  URGENCY_SCORES,
  REQUEST_STATUS,
  BED_STATUS,
  APPOINTMENT_STATUS,
  EXCEPTION_TYPES
};

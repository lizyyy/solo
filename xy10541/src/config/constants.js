const ORDER_STATUS = {
  CREATED: 'created',
  SCHEDULING: 'scheduling',
  TECHNICIAN_ASSIGNED: 'technician_assigned',
  PARTS_ALLOCATED: 'parts_allocated',
  CONFIRMING: 'confirming',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULING: 'rescheduling'
};

const RESCHEDULE_TYPE = {
  CUSTOMER: 'customer',
  TECHNICIAN: 'technician',
  SYSTEM: 'system'
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  REJECTED: 'rejected'
};

const MAX_CUSTOMER_RESCHEDULES = 3;
const CONFIRMATION_TIMEOUT_HOURS = 24;
const LATE_THRESHOLD_MINUTES = 30;
const COMPENSATION_RATE = 50;

const EVENT_TYPES = {
  ORDER_CREATED: 'order_created',
  TECHNICIAN_ASSIGNED: 'technician_assigned',
  TECHNICIAN_CHANGED: 'technician_changed',
  PARTS_ALLOCATED: 'parts_allocated',
  PARTS_RELEASED: 'parts_released',
  CONFIRMATION_SENT: 'confirmation_sent',
  CONFIRMATION_RECEIVED: 'confirmation_received',
  CONFIRMATION_TIMEOUT: 'confirmation_timeout',
  RESCHEDULE_REQUESTED: 'reschedule_requested',
  RESCHEDULE_APPROVED: 'reschedule_approved',
  RESCHEDULE_COMPLETED: 'reschedule_completed',
  COMPENSATION_INITIATED: 'compensation_initiated',
  COMPENSATION_PAID: 'compensation_paid',
  ORDER_STARTED: 'order_started',
  ORDER_COMPLETED: 'order_completed',
  ORDER_CANCELLED: 'order_cancelled',
  MANUAL_CORRECTION: 'manual_correction'
};

module.exports = {
  ORDER_STATUS,
  RESCHEDULE_TYPE,
  PAYMENT_STATUS,
  MAX_CUSTOMER_RESCHEDULES,
  CONFIRMATION_TIMEOUT_HOURS,
  LATE_THRESHOLD_MINUTES,
  COMPENSATION_RATE,
  EVENT_TYPES
};

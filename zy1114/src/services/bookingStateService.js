const { StateTransitionError } = require('../utils/errors');
const db = require('../config/database');

const BOOKING_STATES = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  DEPOSIT_PAID: 'deposit_paid',
  CHECKED_IN: 'checked_in',
  IN_USE: 'in_use',
  PENDING_SETTLEMENT: 'pending_settlement',
  SETTLED: 'settled',
  CANCELLED: 'cancelled'
};

const VALID_TRANSITIONS = {
  [BOOKING_STATES.PENDING_CONFIRMATION]: [
    BOOKING_STATES.DEPOSIT_PAID,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.DEPOSIT_PAID]: [
    BOOKING_STATES.CHECKED_IN,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.CHECKED_IN]: [
    BOOKING_STATES.IN_USE,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.IN_USE]: [
    BOOKING_STATES.PENDING_SETTLEMENT
  ],
  [BOOKING_STATES.PENDING_SETTLEMENT]: [
    BOOKING_STATES.SETTLED,
    BOOKING_STATES.IN_USE
  ],
  [BOOKING_STATES.SETTLED]: [],
  [BOOKING_STATES.CANCELLED]: []
};

const STATE_DISPLAY_NAMES = {
  [BOOKING_STATES.PENDING_CONFIRMATION]: '待确认',
  [BOOKING_STATES.DEPOSIT_PAID]: '已付押金',
  [BOOKING_STATES.CHECKED_IN]: '已到店',
  [BOOKING_STATES.IN_USE]: '使用中',
  [BOOKING_STATES.PENDING_SETTLEMENT]: '待结算',
  [BOOKING_STATES.SETTLED]: '已结清',
  [BOOKING_STATES.CANCELLED]: '已取消'
};

function canTransition(currentState, targetState) {
  const allowedStates = VALID_TRANSITIONS[currentState] || [];
  return allowedStates.includes(targetState);
}

function validateTransition(currentState, targetState) {
  if (!canTransition(currentState, targetState)) {
    throw new StateTransitionError(
      `预约状态不能从 "${STATE_DISPLAY_NAMES[currentState]}" 切换到 "${STATE_DISPLAY_NAMES[targetState]}"`,
      currentState,
      targetState
    );
  }
  return true;
}

function logStatusChange(bookingId, oldStatus, newStatus, changedBy, reason) {
  const stmt = db.prepare(`
    INSERT INTO booking_status_logs (booking_id, old_status, new_status, changed_by, reason)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(bookingId, oldStatus, newStatus, changedBy, reason);
}

function updateBookingStatus(bookingId, newStatus, changedBy, reason) {
  const booking = db.prepare('SELECT id, status FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return null;
  }
  
  if (booking.status !== newStatus) {
    validateTransition(booking.status, newStatus);
    logStatusChange(bookingId, booking.status, newStatus, changedBy, reason);
    
    const stmt = db.prepare(`
      UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(newStatus, bookingId);
  }
  
  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
}

function getStateDisplayName(state) {
  return STATE_DISPLAY_NAMES[state] || state;
}

function getValidNextStates(currentState) {
  return VALID_TRANSITIONS[currentState] || [];
}

function isModifiableState(state) {
  return [
    BOOKING_STATES.PENDING_CONFIRMATION,
    BOOKING_STATES.DEPOSIT_PAID,
    BOOKING_STATES.CHECKED_IN,
    BOOKING_STATES.IN_USE,
    BOOKING_STATES.PENDING_SETTLEMENT
  ].includes(state);
}

function isActiveState(state) {
  return [
    BOOKING_STATES.PENDING_CONFIRMATION,
    BOOKING_STATES.DEPOSIT_PAID,
    BOOKING_STATES.CHECKED_IN,
    BOOKING_STATES.IN_USE,
    BOOKING_STATES.PENDING_SETTLEMENT
  ].includes(state);
}

module.exports = {
  BOOKING_STATES,
  VALID_TRANSITIONS,
  STATE_DISPLAY_NAMES,
  canTransition,
  validateTransition,
  logStatusChange,
  updateBookingStatus,
  getStateDisplayName,
  getValidNextStates,
  isModifiableState,
  isActiveState
};

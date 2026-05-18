const CHANGE_STATUSES = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ABNORMAL: 'abnormal'
};

const CHANGE_TYPES = {
  OWNER_TEMPORARY_FOOD_CHANGE: 'owner_temporary_food_change',
  INVENTORY_SHORTAGE_SWITCH: 'inventory_shortage_switch',
  FEEDING_TIME_ADJUSTMENT: 'feeding_time_adjustment',
  AMOUNT_ADJUSTMENT: 'amount_adjustment',
  HEALTH_RELATED_CHANGE: 'health_related_change'
};

const SUBMIT_SOURCES = {
  OWNER_WECHAT: 'owner_wechat',
  OWNER_PHONE: 'owner_phone',
  STAFF_SYSTEM: 'staff_system',
  AUTOMATIC_DETECTION: 'automatic_detection'
};

const ACTIONS = {
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REJECT: 'reject',
  START_EXECUTE: 'start_execute',
  COMPLETE: 'complete',
  CANCEL: 'cancel',
  MARK_ABNORMAL: 'mark_abnormal',
  RESOLVE_ABNORMAL: 'resolve_abnormal'
};

const STATUS_TRANSITIONS = {
  [CHANGE_STATUSES.PENDING_REVIEW]: {
    allowedActions: [ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.CANCEL],
    nextStatuses: [CHANGE_STATUSES.APPROVED, CHANGE_STATUSES.REJECTED, CHANGE_STATUSES.CANCELLED]
  },
  [CHANGE_STATUSES.APPROVED]: {
    allowedActions: [ACTIONS.START_EXECUTE, ACTIONS.CANCEL],
    nextStatuses: [CHANGE_STATUSES.EXECUTING, CHANGE_STATUSES.CANCELLED]
  },
  [CHANGE_STATUSES.REJECTED]: {
    allowedActions: [ACTIONS.SUBMIT],
    nextStatuses: [CHANGE_STATUSES.PENDING_REVIEW]
  },
  [CHANGE_STATUSES.EXECUTING]: {
    allowedActions: [ACTIONS.COMPLETE, ACTIONS.MARK_ABNORMAL],
    nextStatuses: [CHANGE_STATUSES.COMPLETED, CHANGE_STATUSES.ABNORMAL]
  },
  [CHANGE_STATUSES.COMPLETED]: {
    allowedActions: [],
    nextStatuses: []
  },
  [CHANGE_STATUSES.CANCELLED]: {
    allowedActions: [],
    nextStatuses: []
  },
  [CHANGE_STATUSES.ABNORMAL]: {
    allowedActions: [ACTIONS.RESOLVE_ABNORMAL, ACTIONS.CANCEL],
    nextStatuses: [CHANGE_STATUSES.PENDING_REVIEW, CHANGE_STATUSES.CANCELLED]
  }
};

const CONFLICT_TYPES = {
  INVENTORY_SHORTAGE: 'inventory_shortage',
  DAILY_REPORT_INCONSISTENCY: 'daily_report_inconsistency',
  DUPLICATE_CHANGE_REQUEST: 'duplicate_change_request'
};

module.exports = {
  CHANGE_STATUSES,
  CHANGE_TYPES,
  SUBMIT_SOURCES,
  ACTIONS,
  STATUS_TRANSITIONS,
  CONFLICT_TYPES
};

const { v4: uuidv4 } = require('uuid');

class BusinessError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BusinessError';
  }
}

const ERROR_CODES = {
  WIND_SPEED_EXCEEDED: 'WIND_SPEED_EXCEEDED',
  WIND_SPEED_INVALID: 'WIND_SPEED_INVALID',
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  SCHEDULE_ALREADY_CANCELLED: 'SCHEDULE_ALREADY_CANCELLED',
  SCHEDULE_ALREADY_COMPLETED: 'SCHEDULE_ALREADY_COMPLETED',
  SCHEDULE_IN_PROGRESS: 'SCHEDULE_IN_PROGRESS',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  TICKET_ALREADY_USED: 'TICKET_ALREADY_USED',
  TICKET_ALREADY_REFUNDED: 'TICKET_ALREADY_REFUNDED',
  TICKET_NOT_LOCKED: 'TICKET_NOT_LOCKED',
  TICKET_REFUND_NOT_ALLOWED: 'TICKET_REFUND_NOT_ALLOWED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

const STATUS = {
  WIND: {
    NORMAL: 'NORMAL',
    WARNING: 'WARNING',
    STOPPED: 'STOPPED'
  },
  SCHEDULE: {
    PLANNED: 'PLANNED',
    RUNNING: 'RUNNING',
    DELAYED: 'DELAYED',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED'
  },
  TICKET: {
    PURCHASED: 'PURCHASED',
    LOCKED: 'LOCKED',
    REFUNDABLE: 'REFUNDABLE',
    REFUNDED: 'REFUNDED',
    USED: 'USED'
  }
};

const ENTITY_TYPES = {
  WIND_SPEED: 'WIND_SPEED',
  SCHEDULE: 'SCHEDULE',
  TICKET: 'TICKET'
};

const OPERATIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  CANCEL: 'CANCEL',
  LOCK: 'LOCK',
  REFUND: 'REFUND',
  WIND_STATUS_CHANGE: 'WIND_STATUS_CHANGE',
  SCHEDULE_STATUS_CHANGE: 'SCHEDULE_STATUS_CHANGE',
  TICKET_STATUS_CHANGE: 'TICKET_STATUS_CHANGE'
};

function generateId() {
  return uuidv4();
}

function safeJsonParse(str, defaultValue = null) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

function safeJsonStringify(obj) {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

module.exports = {
  BusinessError,
  ERROR_CODES,
  STATUS,
  ENTITY_TYPES,
  OPERATIONS,
  generateId,
  safeJsonParse,
  safeJsonStringify
};

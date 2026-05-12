const { v4: uuidv4 } = require('uuid');

let storage = {
  equipment: {},
  rentalOrders: {},
  depositLedgers: {},
  feeDetails: {},
  auditLogs: [],
  idempotencyKeys: {},
  refundCallbacks: {},
  statusHistory: {}
};

function save() {
  return Promise.resolve();
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${uuidv4().slice(0, 8)}`;
}

module.exports = {
  storage,
  save,
  generateId,
  EQUIPMENT_STATUS: {
    AVAILABLE: 'AVAILABLE',
    RENTED: 'RENTED',
    IN_CHECK: 'IN_CHECK',
    DAMAGED: 'DAMAGED',
    MAINTENANCE: 'MAINTENANCE'
  },
  ORDER_STATUS: {
    CREATED: 'CREATED',
    DEPOSIT_FROZEN: 'DEPOSIT_FROZEN',
    RENTING: 'RENTING',
    RENEWED: 'RENEWED',
    RETURNED: 'RETURNED',
    IN_DAMAGE_ASSESSMENT: 'IN_DAMAGE_ASSESSMENT',
    FEES_SETTLED: 'FEES_SETTLED',
    REFUND_PROCESSING: 'REFUND_PROCESSING',
    REFUND_SUCCESS: 'REFUND_SUCCESS',
    REFUND_FAILED: 'REFUND_FAILED',
    CANCELLED: 'CANCELLED',
    EXCEPTION: 'EXCEPTION'
  },
  TRANSACTION_TYPE: {
    FROZEN: 'FROZEN',
    UNFROZEN: 'UNFROZEN',
    DEDUCT_OVERDUE: 'DEDUCT_OVERDUE',
    DEDUCT_DAMAGE: 'DEDUCT_DAMAGE',
    REFUND: 'REFUND',
    MANUAL_ADJUST: 'MANUAL_ADJUST'
  },
  FEE_TYPE: {
    RENTAL: 'RENTAL',
    OVERDUE: 'OVERDUE',
    DAMAGE: 'DAMAGE',
    DEPOSIT: 'DEPOSIT'
  }
};
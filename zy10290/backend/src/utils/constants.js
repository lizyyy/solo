const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDING: 'refunding',
  REFUNDED: 'refunded',
  PARTIAL_REFUNDED: 'partial_refunded'
};

const SHIPPING_STATUS = {
  UNSHIPPED: 'unshipped',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  RETURNED: 'returned'
};

const REFUND_STATUS = {
  NONE: 'none',
  REQUESTED: 'requested',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected'
};

const COMPENSATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const INVENTORY_CHANGE_TYPE = {
  LOCK: 'lock',
  CONFIRM: 'confirm',
  RELEASE: 'release',
  COMPENSATION_LOCK: 'compensation_lock',
  COMPENSATION_CONFIRM: 'compensation_confirm',
  REFUND_RETURN: 'refund_return',
  MANUAL_ADJUST: 'manual_adjust'
};

const ACTIVITY_STATUS = {
  PENDING: 'pending',
  ONGOING: 'ongoing',
  ENDED: 'ended',
  CANCELLED: 'cancelled'
};

module.exports = {
  ORDER_STATUS,
  PAYMENT_STATUS,
  SHIPPING_STATUS,
  REFUND_STATUS,
  COMPENSATION_STATUS,
  INVENTORY_CHANGE_TYPE,
  ACTIVITY_STATUS
};

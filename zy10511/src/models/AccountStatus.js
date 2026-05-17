const ACCOUNT_STATUS = {
  AVAILABLE: 'available',
  BORROWED: 'borrowed',
  IN_USE: 'in_use',
  OVERDUE: 'overdue',
  MAINTENANCE: 'maintenance',
  ABNORMAL: 'abnormal'
};

const BORROW_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  ABNORMAL: 'abnormal'
};

const OPERATION_TYPE = {
  CREATE: 'create',
  BORROW: 'borrow',
  RETURN: 'return',
  MANUAL_CORRECT: 'manual_correct',
  ABNORMAL_HANDLE: 'abnormal_handle',
  OVERDUE_RECOVER: 'overdue_recover',
  STATUS_CHANGE: 'status_change'
};

module.exports = {
  ACCOUNT_STATUS,
  BORROW_STATUS,
  OPERATION_TYPE
};

const HAZARD_STATUS = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  RECTIFYING: 'rectifying',
  REVIEWING: 'reviewing',
  CLOSED: 'closed',
  REJECTED: 'rejected'
};

const HAZARD_STATUS_LABELS = {
  [HAZARD_STATUS.NEW]: '新建',
  [HAZARD_STATUS.ASSIGNED]: '已分配',
  [HAZARD_STATUS.RECTIFYING]: '整改中',
  [HAZARD_STATUS.REVIEWING]: '复查中',
  [HAZARD_STATUS.CLOSED]: '已闭环',
  [HAZARD_STATUS.REJECTED]: '已驳回'
};

const HAZARD_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const HAZARD_LEVEL_LABELS = {
  [HAZARD_LEVEL.LOW]: '低',
  [HAZARD_LEVEL.MEDIUM]: '中',
  [HAZARD_LEVEL.HIGH]: '高',
  [HAZARD_LEVEL.CRITICAL]: '重大'
};

const IMPORT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed'
};

const RECORD_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

const BATCH_SIZE = 100;

module.exports = {
  HAZARD_STATUS,
  HAZARD_STATUS_LABELS,
  HAZARD_LEVEL,
  HAZARD_LEVEL_LABELS,
  IMPORT_STATUS,
  RECORD_STATUS,
  BATCH_SIZE
};

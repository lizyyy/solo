const { InvalidTransitionError } = require('./errors');

const SPECIMEN_STATUS = {
  CREATED: 'created',
  IN_BATCH: 'in_batch',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  REPORTED: 'reported',
  COMPLETED: 'completed'
};

const SPECIMEN_TRANSITIONS = {
  [SPECIMEN_STATUS.CREATED]: [SPECIMEN_STATUS.IN_BATCH],
  [SPECIMEN_STATUS.IN_BATCH]: [SPECIMEN_STATUS.SHIPPED],
  [SPECIMEN_STATUS.SHIPPED]: [SPECIMEN_STATUS.IN_TRANSIT],
  [SPECIMEN_STATUS.IN_TRANSIT]: [SPECIMEN_STATUS.DELIVERED],
  [SPECIMEN_STATUS.DELIVERED]: [SPECIMEN_STATUS.REPORTED],
  [SPECIMEN_STATUS.REPORTED]: [SPECIMEN_STATUS.COMPLETED],
  [SPECIMEN_STATUS.COMPLETED]: []
};

const BATCH_STATUS = {
  CREATED: 'created',
  READY: 'ready',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  REPORTED: 'reported'
};

const BATCH_TRANSITIONS = {
  [BATCH_STATUS.CREATED]: [BATCH_STATUS.READY],
  [BATCH_STATUS.READY]: [BATCH_STATUS.SHIPPED],
  [BATCH_STATUS.SHIPPED]: [BATCH_STATUS.IN_TRANSIT],
  [BATCH_STATUS.IN_TRANSIT]: [BATCH_STATUS.DELIVERED],
  [BATCH_STATUS.DELIVERED]: [BATCH_STATUS.REPORTED],
  [BATCH_STATUS.REPORTED]: []
};

const CHAIN_SEGMENT_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
};

const CHAIN_SEGMENT_TRANSITIONS = {
  [CHAIN_SEGMENT_STATUS.IN_PROGRESS]: [CHAIN_SEGMENT_STATUS.COMPLETED],
  [CHAIN_SEGMENT_STATUS.COMPLETED]: []
};

const REPORT_STATUS = {
  PENDING: 'pending',
  GENERATED: 'generated',
  REVIEWED: 'reviewed',
  FINALIZED: 'finalized'
};

const REPORT_TRANSITIONS = {
  [REPORT_STATUS.PENDING]: [REPORT_STATUS.GENERATED],
  [REPORT_STATUS.GENERATED]: [REPORT_STATUS.REVIEWED],
  [REPORT_STATUS.REVIEWED]: [REPORT_STATUS.FINALIZED],
  [REPORT_STATUS.FINALIZED]: []
};

function canTransition(entityType, fromStatus, toStatus) {
  let transitions;

  switch (entityType) {
    case 'specimen':
      transitions = SPECIMEN_TRANSITIONS;
      break;
    case 'batch':
      transitions = BATCH_TRANSITIONS;
      break;
    case 'chain_segment':
      transitions = CHAIN_SEGMENT_TRANSITIONS;
      break;
    case 'report':
      transitions = REPORT_TRANSITIONS;
      break;
    default:
      throw new Error(`未知实体类型: ${entityType}`);
  }

  const allowedTransitions = transitions[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

function validateTransition(entityType, fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return true;
  }

  if (!canTransition(entityType, fromStatus, toStatus)) {
    throw new InvalidTransitionError(entityType, fromStatus, toStatus);
  }

  return true;
}

function getAllowedTransitions(entityType, currentStatus) {
  let transitions;

  switch (entityType) {
    case 'specimen':
      transitions = SPECIMEN_TRANSITIONS;
      break;
    case 'batch':
      transitions = BATCH_TRANSITIONS;
      break;
    case 'chain_segment':
      transitions = CHAIN_SEGMENT_TRANSITIONS;
      break;
    case 'report':
      transitions = REPORT_TRANSITIONS;
      break;
    default:
      throw new Error(`未知实体类型: ${entityType}`);
  }

  return transitions[currentStatus] || [];
}

module.exports = {
  SPECIMEN_STATUS,
  SPECIMEN_TRANSITIONS,
  BATCH_STATUS,
  BATCH_TRANSITIONS,
  CHAIN_SEGMENT_STATUS,
  CHAIN_SEGMENT_TRANSITIONS,
  REPORT_STATUS,
  REPORT_TRANSITIONS,
  canTransition,
  validateTransition,
  getAllowedTransitions
};

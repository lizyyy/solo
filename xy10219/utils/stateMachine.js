const FAULT_ORDER_STATUS = {
  CREATED: 'CREATED',
  AWAITING_PARTS: 'AWAITING_PARTS',
  PARTS_RECEIVED: 'PARTS_RECEIVED',
  REPLACED: 'REPLACED',
  COMPLETED: 'COMPLETED',
  REVERTED: 'REVERTED'
};

const STATUS_TRANSITIONS = {
  [FAULT_ORDER_STATUS.CREATED]: [FAULT_ORDER_STATUS.AWAITING_PARTS],
  [FAULT_ORDER_STATUS.AWAITING_PARTS]: [FAULT_ORDER_STATUS.PARTS_RECEIVED, FAULT_ORDER_STATUS.REVERTED],
  [FAULT_ORDER_STATUS.PARTS_RECEIVED]: [FAULT_ORDER_STATUS.REPLACED, FAULT_ORDER_STATUS.REVERTED],
  [FAULT_ORDER_STATUS.REPLACED]: [FAULT_ORDER_STATUS.COMPLETED, FAULT_ORDER_STATUS.REVERTED],
  [FAULT_ORDER_STATUS.COMPLETED]: [],
  [FAULT_ORDER_STATUS.REVERTED]: [FAULT_ORDER_STATUS.CREATED]
};

const STATUS_LABELS = {
  [FAULT_ORDER_STATUS.CREATED]: '故障单已创建',
  [FAULT_ORDER_STATUS.AWAITING_PARTS]: '等待备件领用',
  [FAULT_ORDER_STATUS.PARTS_RECEIVED]: '备件已签收',
  [FAULT_ORDER_STATUS.REPLACED]: '更换完成待复核',
  [FAULT_ORDER_STATUS.COMPLETED]: '已完成',
  [FAULT_ORDER_STATUS.REVERTED]: '已撤回/修正'
};

function canTransition(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

function validateTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(
      `状态转换不允许: 从 ${STATUS_LABELS[fromStatus] || fromStatus} 无法转换到 ${STATUS_LABELS[toStatus] || toStatus}`
    );
  }
  return true;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

module.exports = {
  FAULT_ORDER_STATUS,
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  canTransition,
  validateTransition,
  getStatusLabel
};

const Contract = require('../models/Contract');

const SIGN_STATUSES = Contract.getStatuses();

const STATE_TRANSITIONS = {
  [SIGN_STATUSES.DRAFT]: {
    allowed: [SIGN_STATUSES.INITIATED],
    description: '草稿 -> 已发起'
  },
  [SIGN_STATUSES.INITIATED]: {
    allowed: [SIGN_STATUSES.IN_SIGNING, SIGN_STATUSES.WITHDRAWN],
    description: '已发起 -> 签署中/已撤回'
  },
  [SIGN_STATUSES.IN_SIGNING]: {
    allowed: [
      SIGN_STATUSES.PARTIALLY_SIGNED,
      SIGN_STATUSES.WITHDRAWN,
      SIGN_STATUSES.REJECTED,
      SIGN_STATUSES.COMPLETED
    ],
    description: '签署中 -> 部分签署/已撤回/已拒签/已完成'
  },
  [SIGN_STATUSES.PARTIALLY_SIGNED]: {
    allowed: [
      SIGN_STATUSES.WITHDRAWN,
      SIGN_STATUSES.REJECTED,
      SIGN_STATUSES.COMPLETED,
      SIGN_STATUSES.IN_SIGNING
    ],
    description: '部分签署 -> 已撤回/已拒签/已完成/签署中'
  },
  [SIGN_STATUSES.WITHDRAWN]: {
    allowed: [SIGN_STATUSES.REINITIATED, SIGN_STATUSES.DRAFT],
    description: '已撤回 -> 重新发起/草稿'
  },
  [SIGN_STATUSES.REJECTED]: {
    allowed: [SIGN_STATUSES.REINITIATED, SIGN_STATUSES.DRAFT],
    description: '已拒签 -> 重新发起/草稿'
  },
  [SIGN_STATUSES.COMPLETED]: {
    allowed: [],
    description: '已完成 -> 无（终态'
  },
  [SIGN_STATUSES.REINITIATED]: {
    allowed: [SIGN_STATUSES.IN_SIGNING, SIGN_STATUSES.WITHDRAWN],
    description: '重新发起 -> 签署中/已撤回'
  }
};

const OPERATIONS = {
  CREATE: 'create',
  INITIATE: 'initiate',
  SIGN: 'sign',
  REJECT: 'reject',
  WITHDRAW: 'withdraw',
  REINITIATE: 'reinitiate',
  SUPPLEMENT_SIGN: 'supplement_sign',
  COMPLETE: 'complete',
  UPDATE: 'update'
};

const OPERATION_STATE_MAP = {
  [OPERATIONS.INITIATE]: {
    from: [SIGN_STATUSES.DRAFT],
    to: SIGN_STATUSES.INITIATED
  },
  [OPERATIONS.SIGN]: {
    from: [SIGN_STATUSES.INITIATED, SIGN_STATUSES.IN_SIGNING, SIGN_STATUSES.PARTIALLY_SIGNED, SIGN_STATUSES.REINITIATED],
    to: SIGN_STATUSES.IN_SIGNING
  },
  [OPERATIONS.REJECT]: {
    from: [SIGN_STATUSES.INITIATED, SIGN_STATUSES.IN_SIGNING, SIGN_STATUSES.PARTIALLY_SIGNED, SIGN_STATUSES.REINITIATED],
    to: SIGN_STATUSES.REJECTED
  },
  [OPERATIONS.WITHDRAW]: {
    from: [SIGN_STATUSES.INITIATED, SIGN_STATUSES.IN_SIGNING, SIGN_STATUSES.PARTIALLY_SIGNED, SIGN_STATUSES.REINITIATED],
    to: SIGN_STATUSES.WITHDRAWN
  },
  [OPERATIONS.REINITIATE]: {
    from: [SIGN_STATUSES.WITHDRAWN, SIGN_STATUSES.REJECTED],
    to: SIGN_STATUSES.REINITIATED
  },
  [OPERATIONS.SUPPLEMENT_SIGN]: {
    from: [SIGN_STATUSES.PARTIALLY_SIGNED],
    to: SIGN_STATUSES.IN_SIGNING
  },
  [OPERATIONS.COMPLETE]: {
    from: [SIGN_STATUSES.IN_SIGNING, SIGN_STATUSES.PARTIALLY_SIGNED],
    to: SIGN_STATUSES.COMPLETED
  }
};

function canTransition(currentState, nextState) {
  const transition = STATE_TRANSITIONS[currentState];
  if (!transition) {
    return {
      allowed: false,
      reason: `未知的状态: ${currentState}`
    };
  }
  
  const isAllowed = transition.allowed.includes(nextState);
  return {
    allowed: isAllowed,
    reason: isAllowed ? '允许' : `状态转换不允许: ${currentState} -> ${nextState}. 允许的目标状态: ${transition.allowed.join(', ')}`
  };
}

function canPerformOperation(currentState, operation) {
  const opMap = OPERATION_STATE_MAP[operation];
  if (!opMap) {
    return {
      allowed: false,
      reason: `未知操作: ${operation}`
    };
  }

  const isValidFrom = opMap.from.includes(currentState);
  return {
    allowed: isValidFrom,
    reason: isValidFrom 
      ? `允许执行 ${operation}`
      : `当前状态 ${currentState} 不允许执行 ${operation}. 允许的起始状态: ${opMap.from.join(', ')}`,
    targetState: opMap.to
  };
}

function getNextStateForOperation(operation) {
  const opMap = OPERATION_STATE_MAP[operation];
  return opMap ? opMap.to : null;
}

function isTerminalState(state) {
  const transition = STATE_TRANSITIONS[state];
  return transition && transition.allowed.length === 0;
}

function getAllowedTransitions(state) {
  const transition = STATE_TRANSITIONS[state];
  return transition ? transition.allowed : [];
}

function getStateDescription(state) {
  const stateMap = {
    [SIGN_STATUSES.DRAFT]: '草稿',
    [SIGN_STATUSES.INITIATED]: '已发起',
    [SIGN_STATUSES.IN_SIGNING]: '签署中',
    [SIGN_STATUSES.PARTIALLY_SIGNED]: '部分签署',
    [SIGN_STATUSES.WITHDRAWN]: '已撤回',
    [SIGN_STATUSES.REJECTED]: '已拒签',
    [SIGN_STATUSES.COMPLETED]: '已完成',
    [SIGN_STATUSES.REINITIATED]: '重新发起'
  };
  return stateMap[state] || state;
}

function getOperationDescription(operation) {
  const opMap = {
    [OPERATIONS.CREATE]: '创建合同',
    [OPERATIONS.INITIATE]: '发起签署',
    [OPERATIONS.SIGN]: '签署',
    [OPERATIONS.REJECT]: '拒签',
    [OPERATIONS.WITHDRAW]: '撤回',
    [OPERATIONS.REINITIATE]: '重新发起',
    [OPERATIONS.SUPPLEMENT_SIGN]: '补签',
    [OPERATIONS.COMPLETE]: '完成签署',
    [OPERATIONS.UPDATE]: '更新合同'
  };
  return opMap[operation] || operation;
}

module.exports = {
  SIGN_STATUSES,
  OPERATIONS,
  STATE_TRANSITIONS,
  OPERATION_STATE_MAP,
  canTransition,
  canPerformOperation,
  getNextStateForOperation,
  isTerminalState,
  getAllowedTransitions,
  getStateDescription,
  getOperationDescription
};

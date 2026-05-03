const { StateMachineError } = require('./errors');

const ORDER_STATES = {
  DRAFT: 'draft',
  DEPOSIT_LOCKED: 'deposit_locked',
  SHIPPED: 'shipped',
  BUYER_INSPECTING: 'buyer_inspecting',
  RELEASED: 'released',
  PARTIALLY_REFUNDED: 'partially_refunded',
  DISPUTED: 'disputed',
  COMPLETED: 'completed',
  CLOSED: 'closed'
};

const ORDER_STATE_LABELS = {
  draft: '草稿',
  deposit_locked: '已锁定订金',
  shipped: '已发货',
  buyer_inspecting: '买家验货中',
  released: '确认放款',
  partially_refunded: '部分退款',
  disputed: '争议中',
  completed: '已完成',
  closed: '已关闭'
};

const STATE_TRANSITIONS = {
  [ORDER_STATES.DRAFT]: {
    to: [ORDER_STATES.DEPOSIT_LOCKED, ORDER_STATES.CLOSED],
    actions: ['confirm_deposit', 'cancel']
  },
  [ORDER_STATES.DEPOSIT_LOCKED]: {
    to: [ORDER_STATES.SHIPPED, ORDER_STATES.CLOSED],
    actions: ['ship', 'cancel']
  },
  [ORDER_STATES.SHIPPED]: {
    to: [ORDER_STATES.BUYER_INSPECTING, ORDER_STATES.DISPUTED],
    actions: ['deliver', 'raise_dispute']
  },
  [ORDER_STATES.BUYER_INSPECTING]: {
    to: [ORDER_STATES.RELEASED, ORDER_STATES.PARTIALLY_REFUNDED, ORDER_STATES.DISPUTED],
    actions: ['confirm_release', 'request_partial_refund', 'raise_dispute']
  },
  [ORDER_STATES.RELEASED]: {
    to: [ORDER_STATES.COMPLETED],
    actions: ['complete']
  },
  [ORDER_STATES.PARTIALLY_REFUNDED]: {
    to: [ORDER_STATES.CLOSED, ORDER_STATES.DISPUTED],
    actions: ['close', 'raise_dispute']
  },
  [ORDER_STATES.DISPUTED]: {
    to: [ORDER_STATES.RELEASED, ORDER_STATES.PARTIALLY_REFUNDED, ORDER_STATES.CLOSED],
    actions: ['resolve_release', 'resolve_partial_refund', 'resolve_close']
  },
  [ORDER_STATES.COMPLETED]: {
    to: [],
    actions: []
  },
  [ORDER_STATES.CLOSED]: {
    to: [],
    actions: []
  }
};

const ACTION_TO_STATE = {
  confirm_deposit: ORDER_STATES.DEPOSIT_LOCKED,
  cancel: ORDER_STATES.CLOSED,
  ship: ORDER_STATES.SHIPPED,
  deliver: ORDER_STATES.BUYER_INSPECTING,
  confirm_release: ORDER_STATES.RELEASED,
  request_partial_refund: ORDER_STATES.PARTIALLY_REFUNDED,
  raise_dispute: ORDER_STATES.DISPUTED,
  complete: ORDER_STATES.COMPLETED,
  close: ORDER_STATES.CLOSED,
  resolve_release: ORDER_STATES.RELEASED,
  resolve_partial_refund: ORDER_STATES.PARTIALLY_REFUNDED,
  resolve_close: ORDER_STATES.CLOSED
};

const canTransition = (currentState, targetState) => {
  const transitions = STATE_TRANSITIONS[currentState];
  if (!transitions) {
    return false;
  }
  return transitions.to.includes(targetState);
};

const canDoAction = (currentState, action) => {
  const transitions = STATE_TRANSITIONS[currentState];
  if (!transitions) {
    return false;
  }
  return transitions.actions.includes(action);
};

const getTargetState = (action) => {
  return ACTION_TO_STATE[action];
};

const validateTransition = (currentState, targetState, action = null) => {
  if (action) {
    if (!canDoAction(currentState, action)) {
      throw new StateMachineError(
        `当前状态"${ORDER_STATE_LABELS[currentState]}"不允许执行操作"${action}"`,
        'INVALID_ACTION'
      );
    }
    const expectedTarget = getTargetState(action);
    if (targetState && expectedTarget !== targetState) {
      throw new StateMachineError(
        `操作"${action}"应该流转到状态"${ORDER_STATE_LABELS[expectedTarget]}"，但目标状态是"${ORDER_STATE_LABELS[targetState]}"`,
        'STATE_MISMATCH'
      );
    }
    return { canTransition: true, targetState: expectedTarget };
  }

  if (!canTransition(currentState, targetState)) {
    throw new StateMachineError(
      `无法从状态"${ORDER_STATE_LABELS[currentState]}"流转到"${ORDER_STATE_LABELS[targetState]}"`,
      'INVALID_TRANSITION'
    );
  }

  return { canTransition: true };
};

const getAvailableActions = (currentState) => {
  const transitions = STATE_TRANSITIONS[currentState];
  if (!transitions) {
    return [];
  }
  return transitions.actions.map(action => ({
    action,
    targetState: ACTION_TO_STATE[action],
    targetStateLabel: ORDER_STATE_LABELS[ACTION_TO_STATE[action]]
  }));
};

const getStateLabel = (state) => {
  return ORDER_STATE_LABELS[state] || state;
};

module.exports = {
  ORDER_STATES,
  ORDER_STATE_LABELS,
  STATE_TRANSITIONS,
  ACTION_TO_STATE,
  canTransition,
  canDoAction,
  getTargetState,
  validateTransition,
  getAvailableActions,
  getStateLabel
};

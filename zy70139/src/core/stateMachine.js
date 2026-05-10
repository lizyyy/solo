const {
  RECALL_SOURCE_STATES,
  STATE_TRANSITIONS
} = require('./constants');

class StateTransitionError extends Error {
  constructor(sourceId, fromState, toState, reason) {
    super(`状态流转非法: 召回源 [${sourceId}] 从 [${fromState}] 到 [${toState}] 不允许, 原因: ${reason}`);
    this.name = 'StateTransitionError';
    this.sourceId = sourceId;
    this.fromState = fromState;
    this.toState = toState;
    this.reason = reason;
  }
}

class DuplicateTransitionError extends Error {
  constructor(sourceId, currentState, attemptedState) {
    super(`重复状态提交: 召回源 [${sourceId}] 当前已经是 [${currentState}], 无需再切换到 [${attemptedState}]`);
    this.name = 'DuplicateTransitionError';
    this.sourceId = sourceId;
    this.currentState = currentState;
    this.attemptedState = attemptedState;
  }
}

function isValidStateTransition(fromState, toState) {
  const allowedStates = STATE_TRANSITIONS[fromState];
  if (!allowedStates) {
    return {
      valid: false,
      reason: `未知的源状态: ${fromState}`
    };
  }
  
  if (!allowedStates.includes(toState)) {
    return {
      valid: false,
      reason: `从 ${fromState} 只能切换到: ${allowedStates.join(', ')}`
    };
  }
  
  return {
    valid: true,
    reason: '合法'
  };
}

function checkTransition(sourceId, currentState, targetState) {
  if (currentState === targetState) {
    return {
      valid: false,
      isDuplicate: true,
      error: new DuplicateTransitionError(sourceId, currentState, targetState)
    };
  }
  
  const validation = isValidStateTransition(currentState, targetState);
  if (!validation.valid) {
    return {
      valid: false,
      isDuplicate: false,
      error: new StateTransitionError(sourceId, currentState, targetState, validation.reason)
    };
  }
  
  return {
    valid: true,
    isDuplicate: false,
    error: null
  };
}

function getAllStates() {
  return Object.values(RECALL_SOURCE_STATES);
}

function getValidTransitions(fromState) {
  return STATE_TRANSITIONS[fromState] || [];
}

module.exports = {
  isValidStateTransition,
  checkTransition,
  getAllStates,
  getValidTransitions,
  StateTransitionError,
  DuplicateTransitionError
};
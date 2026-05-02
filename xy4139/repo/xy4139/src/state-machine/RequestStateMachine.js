const config = require('../config');
const moment = require('moment');

class StateTransitionError extends Error {
  constructor(message, code = 'STATE_TRANSITION_ERROR') {
    super(message);
    this.name = 'StateTransitionError';
    this.code = code;
    this.status = 400;
  }
}

class RequestStateMachine {
  static states = config.request_status;

  static stateDescriptions = {
    [config.request_status.draft]: {
      name: '草稿',
      description: '申请尚未提交，可以编辑',
      color: 'gray'
    },
    [config.request_status.pending]: {
      name: '待审批',
      description: '申请已提交，等待安全员审批',
      color: 'yellow'
    },
    [config.request_status.approved]: {
      name: '已批准',
      description: '申请已批准，可以领出试剂',
      color: 'blue'
    },
    [config.request_status.rejected]: {
      name: '已驳回',
      description: '申请被驳回，流程结束',
      color: 'red'
    },
    [config.request_status.executed]: {
      name: '已领出',
      description: '试剂已领出，使用中',
      color: 'green'
    },
    [config.request_status.returned]: {
      name: '已归还',
      description: '试剂已归还，流程结束',
      color: 'purple'
    },
    [config.request_status.disposed]: {
      name: '已报废',
      description: '试剂已报废，流程结束',
      color: 'orange'
    }
  };

  static transitions = {
    [config.request_status.draft]: {
      submit: config.request_status.pending
    },
    [config.request_status.pending]: {
      approve: config.request_status.approved,
      reject: config.request_status.rejected
    },
    [config.request_status.approved]: {
      execute: config.request_status.executed
    },
    [config.request_status.executed]: {
      return: config.request_status.returned,
      dispose: config.request_status.disposed
    }
  };

  static canTransition(currentState, action) {
    const stateTransitions = this.transitions[currentState];
    if (!stateTransitions) {
      return false;
    }
    return stateTransitions[action] !== undefined;
  }

  static getNextState(currentState, action) {
    const stateTransitions = this.transitions[currentState];
    if (!stateTransitions || !stateTransitions[action]) {
      throw new StateTransitionError(
        `无法从状态 ${currentState} 执行操作 ${action}`,
        'INVALID_TRANSITION'
      );
    }
    return stateTransitions[action];
  }

  static validateTransition(currentState, action) {
    if (!this.canTransition(currentState, action)) {
      const currentDesc = this.stateDescriptions[currentState]?.name || currentState;
      throw new StateTransitionError(
        `当前状态 [${currentDesc}] 不允许执行此操作`,
        'INVALID_STATE_TRANSITION'
      );
    }
    return true;
  }

  static getAvailableActions(currentState) {
    const stateTransitions = this.transitions[currentState];
    if (!stateTransitions) {
      return [];
    }
    
    const actionDescriptions = {
      submit: { name: '提交申请', description: '将草稿提交审批' },
      approve: { name: '批准', description: '批准领用申请' },
      reject: { name: '驳回', description: '驳回领用申请' },
      execute: { name: '领出', description: '实际领出试剂' },
      return: { name: '归还', description: '归还未用完的试剂' },
      dispose: { name: '报废', description: '报废已使用的试剂' }
    };
    
    return Object.keys(stateTransitions).map(action => ({
      action,
      nextState: stateTransitions[action],
      ...actionDescriptions[action]
    }));
  }

  static getStateDescription(state) {
    return this.stateDescriptions[state] || null;
  }

  static isFinalState(state) {
    const finalStates = [
      config.request_status.rejected,
      config.request_status.returned,
      config.request_status.disposed
    ];
    return finalStates.includes(state);
  }

  static isActiveState(state) {
    const activeStates = [
      config.request_status.pending,
      config.request_status.approved,
      config.request_status.executed
    ];
    return activeStates.includes(state);
  }

  static getStateFlow() {
    return [
      { state: config.request_status.draft, description: '草稿', next: ['pending'] },
      { state: config.request_status.pending, description: '待审批', next: ['approved', 'rejected'] },
      { state: config.request_status.approved, description: '已批准', next: ['executed'] },
      { state: config.request_status.rejected, description: '已驳回', next: [] },
      { state: config.request_status.executed, description: '已领出', next: ['returned', 'disposed'] },
      { state: config.request_status.returned, description: '已归还', next: [] },
      { state: config.request_status.disposed, description: '已报废', next: [] }
    ];
  }

  static transition(request, action, options = {}) {
    const currentState = request.status;
    this.validateTransition(currentState, action);
    
    const nextState = this.getNextState(currentState, action);
    const now = moment().toISOString();
    
    request.status = nextState;
    request.updated_at = now;
    request.updated_by = options.userId;
    
    switch (action) {
      case 'submit':
        request.requested_at = now;
        break;
      case 'approve':
        request.approver_id = options.userId;
        request.approver_name = options.userName;
        request.approved_at = now;
        break;
      case 'reject':
        request.approver_id = options.userId;
        request.approver_name = options.userName;
        request.approved_at = now;
        request.rejection_reason = options.reason;
        break;
      case 'execute':
        request.executor_id = options.userId;
        request.executor_name = options.userName;
        request.executed_at = now;
        break;
      case 'return':
        request.returned_at = now;
        request.return_quantity = options.returnQuantity;
        break;
      case 'dispose':
        request.disposed_at = now;
        request.disposal_reason = options.reason;
        break;
    }
    
    return request;
  }

  static canSubmit(request) {
    return request.status === config.request_status.draft;
  }

  static canApprove(request) {
    return request.status === config.request_status.pending;
  }

  static canReject(request) {
    return request.status === config.request_status.pending;
  }

  static canExecute(request) {
    return request.status === config.request_status.approved;
  }

  static canReturn(request) {
    return request.status === config.request_status.executed;
  }

  static canDispose(request) {
    return request.status === config.request_status.executed;
  }
}

module.exports = { RequestStateMachine, StateTransitionError };

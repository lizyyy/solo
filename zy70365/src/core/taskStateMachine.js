const TASK_STATES = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMED_OUT: 'timed_out',
  CANCELLED: 'cancelled',
  KILLED: 'killed'
};

const TERMINAL_STATES = [
  TASK_STATES.COMPLETED,
  TASK_STATES.FAILED,
  TASK_STATES.TIMED_OUT,
  TASK_STATES.CANCELLED,
  TASK_STATES.KILLED
];

const STATE_TRANSITIONS = {
  [TASK_STATES.PENDING]: [TASK_STATES.SUBMITTED, TASK_STATES.CANCELLED],
  [TASK_STATES.SUBMITTED]: [TASK_STATES.QUEUED, TASK_STATES.CANCELLED],
  [TASK_STATES.QUEUED]: [TASK_STATES.RUNNING, TASK_STATES.CANCELLED],
  [TASK_STATES.RUNNING]: [
    TASK_STATES.COMPLETED,
    TASK_STATES.FAILED,
    TASK_STATES.TIMED_OUT,
    TASK_STATES.CANCELLED,
    TASK_STATES.KILLED,
    TASK_STATES.PAUSED
  ],
  [TASK_STATES.PAUSED]: [TASK_STATES.RUNNING, TASK_STATES.CANCELLED, TASK_STATES.KILLED],
  [TASK_STATES.COMPLETED]: [],
  [TASK_STATES.FAILED]: [],
  [TASK_STATES.TIMED_OUT]: [],
  [TASK_STATES.CANCELLED]: [],
  [TASK_STATES.KILLED]: []
};

const FAILURE_REASONS = {
  PERMISSION_VIOLATION: 'permission_violation',
  RESOURCE_EXCEEDED: 'resource_exceeded',
  EXECUTION_ERROR: 'execution_error',
  TIMED_OUT: 'timed_out',
  CANCELLED_BY_USER: 'cancelled_by_user',
  KILLED_BY_ADMIN: 'killed_by_admin',
  DUPLICATE_SUBMISSION: 'duplicate_submission',
  INVALID_TASK: 'invalid_task'
};

const STATE_DESCRIPTIONS = {
  [TASK_STATES.PENDING]: '任务已创建，等待提交',
  [TASK_STATES.SUBMITTED]: '任务已提交，等待入队',
  [TASK_STATES.QUEUED]: '任务已入队，等待执行',
  [TASK_STATES.RUNNING]: '任务正在执行',
  [TASK_STATES.PAUSED]: '任务已暂停',
  [TASK_STATES.COMPLETED]: '任务执行成功完成',
  [TASK_STATES.FAILED]: '任务执行失败',
  [TASK_STATES.TIMED_OUT]: '任务执行超时',
  [TASK_STATES.CANCELLED]: '任务被用户取消',
  [TASK_STATES.KILLED]: '任务被管理员强制终止'
};

class TaskStateMachine {
  constructor(initialState = TASK_STATES.PENDING) {
    this.currentState = initialState;
    this.stateHistory = [];
    this.failureReason = null;
    this.failureDetails = null;
    this.canWriteResult = true;
    
    this._recordStateTransition(initialState, '初始化');
  }

  getCurrentState() {
    return this.currentState;
  }

  getStateHistory() {
    return [...this.stateHistory];
  }

  getFailureInfo() {
    return {
      reason: this.failureReason,
      details: this.failureDetails
    };
  }

  isTerminal() {
    return TERMINAL_STATES.includes(this.currentState);
  }

  isRunning() {
    return this.currentState === TASK_STATES.RUNNING;
  }

  isCancelled() {
    return this.currentState === TASK_STATES.CANCELLED || this.currentState === TASK_STATES.KILLED;
  }

  canTransitionTo(newState) {
    const allowedTransitions = STATE_TRANSITIONS[this.currentState] || [];
    return allowedTransitions.includes(newState);
  }

  transitionTo(newState, reason = null, details = null) {
    if (!this.canTransitionTo(newState)) {
      throw new Error(
        `无效的状态转换: ${this.currentState} -> ${newState}. ` +
        `允许的转换: ${STATE_TRANSITIONS[this.currentState]?.join(', ') || '无'}`
      );
    }

    this.currentState = newState;
    this._recordStateTransition(newState, reason, details);

    if (this.isCancelled()) {
      this.canWriteResult = false;
    }

    if (newState === TASK_STATES.FAILED || newState === TASK_STATES.TIMED_OUT) {
      this.failureReason = reason;
      this.failureDetails = details;
      this.canWriteResult = false;
    }

    return true;
  }

  submit(reason = '用户提交任务') {
    return this.transitionTo(TASK_STATES.SUBMITTED, reason);
  }

  enqueue(reason = '调度器将任务加入队列') {
    return this.transitionTo(TASK_STATES.QUEUED, reason);
  }

  start(reason = '开始执行任务') {
    return this.transitionTo(TASK_STATES.RUNNING, reason);
  }

  pause(reason = '暂停执行') {
    return this.transitionTo(TASK_STATES.PAUSED, reason);
  }

  resume(reason = '恢复执行') {
    return this.transitionTo(TASK_STATES.RUNNING, reason);
  }

  complete(reason = '任务执行成功完成') {
    return this.transitionTo(TASK_STATES.COMPLETED, reason);
  }

  fail(reason = FAILURE_REASONS.EXECUTION_ERROR, details = null) {
    return this.transitionTo(TASK_STATES.FAILED, reason, details);
  }

  timeout(details = null) {
    return this.transitionTo(TASK_STATES.TIMED_OUT, FAILURE_REASONS.TIMED_OUT, details);
  }

  cancel(reason = '用户取消任务', details = null) {
    return this.transitionTo(TASK_STATES.CANCELLED, FAILURE_REASONS.CANCELLED_BY_USER, details);
  }

  kill(reason = '管理员强制终止任务', details = null) {
    return this.transitionTo(TASK_STATES.KILLED, FAILURE_REASONS.KILLED_BY_ADMIN, details);
  }

  canWriteResults() {
    return this.canWriteResult;
  }

  _recordStateTransition(state, reason = null, details = null) {
    this.stateHistory.push({
      state,
      timestamp: new Date().toISOString(),
      reason,
      details
    });
  }

  getStateDescription() {
    return STATE_DESCRIPTIONS[this.currentState] || '未知状态';
  }

  static getStates() {
    return TASK_STATES;
  }

  static getTerminalStates() {
    return [...TERMINAL_STATES];
  }

  static getStateDescriptions() {
    return { ...STATE_DESCRIPTIONS };
  }

  static getFailureReasons() {
    return FAILURE_REASONS;
  }

  static isValidState(state) {
    return Object.values(TASK_STATES).includes(state);
  }
}

module.exports = {
  TaskStateMachine,
  TASK_STATES,
  TERMINAL_STATES,
  STATE_TRANSITIONS,
  FAILURE_REASONS,
  STATE_DESCRIPTIONS
};

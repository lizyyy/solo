const { v4: uuidv4 } = require('uuid');
const { TaskStateMachine, TASK_STATES, FAILURE_REASONS } = require('./taskStateMachine');
const { PermissionPolicy, POLICY_TYPES } = require('./permissionPolicy');
const { ResourceQuota, QUOTA_PRESETS } = require('./resourceQuota');
const { TaskLogger } = require('../utils/logger');

class Task {
  constructor(options) {
    this.id = options.id || uuidv4();
    this.name = options.name || `task-${this.id.substring(0, 8)}`;
    this.scriptContent = options.scriptContent || '';
    this.scriptType = options.scriptType || 'javascript';
    this.parameters = options.parameters || {};
    
    this.submitter = options.submitter || 'unknown';
    this.operatorHistory = [];
    this.auditRecords = [];
    
    this.policyType = options.policyType || POLICY_TYPES.LIMITED;
    this.customPolicy = options.customPolicy || null;
    this.permissionPolicy = new PermissionPolicy(this.policyType, this.customPolicy);
    
    this.quotaPreset = options.quotaPreset || 'standard';
    this.customQuotas = options.customQuotas || null;
    this.resourceQuota = new ResourceQuota(this.quotaPreset, this.customQuotas);
    
    this.stateMachine = new TaskStateMachine(TASK_STATES.PENDING);
    this.logger = new TaskLogger(this.id);
    
    this.result = null;
    this.executionErrors = [];
    this.violations = [];
    
    this.createdAt = new Date().toISOString();
    this.submittedAt = null;
    this.startedAt = null;
    this.completedAt = null;
    
    this._recordOperation(this.submitter, 'create', '任务创建');
  }

  submit(operator = this.submitter) {
    if (this.stateMachine.getCurrentState() !== TASK_STATES.PENDING) {
      return {
        success: false,
        message: `任务已在 ${this.stateMachine.getStateDescription()} 状态，无法重复提交`
      };
    }

    this.stateMachine.submit('用户提交任务');
    this.submittedAt = new Date().toISOString();
    this.logger.audit('submit', operator, { action: 'submit' });
    this._recordOperation(operator, 'submit', '提交任务');
    
    return {
      success: true,
      message: '任务提交成功',
      taskId: this.id
    };
  }

  enqueue(operator = 'system') {
    if (!this.stateMachine.canTransitionTo(TASK_STATES.QUEUED)) {
      return { success: false, message: '当前状态不允许入队' };
    }
    
    this.stateMachine.enqueue();
    this.logger.system('任务已加入执行队列');
    this._recordOperation(operator, 'enqueue', '任务入队');
    
    return { success: true };
  }

  start(operator = 'system') {
    if (!this.stateMachine.canTransitionTo(TASK_STATES.RUNNING)) {
      return { success: false, message: '当前状态不允许开始执行' };
    }
    
    this.stateMachine.start();
    this.startedAt = new Date().toISOString();
    this.resourceQuota.start();
    this.logger.system('任务开始执行');
    this._recordOperation(operator, 'start', '开始执行');
    
    return { success: true };
  }

  complete(resultData, operator = 'system') {
    if (!this.stateMachine.canTransitionTo(TASK_STATES.COMPLETED)) {
      return { success: false, message: '当前状态不允许完成' };
    }
    
    this.resourceQuota.stop();
    this.result = {
      success: true,
      data: resultData,
      timestamp: new Date().toISOString()
    };
    this.stateMachine.complete('任务执行成功完成');
    this.completedAt = new Date().toISOString();
    this.logger.system('任务执行成功完成');
    this._recordOperation(operator, 'complete', '任务完成');
    
    return { success: true, result: this.result };
  }

  fail(reason = FAILURE_REASONS.EXECUTION_ERROR, details = null, operator = 'system') {
    if (this.stateMachine.isTerminal()) {
      return { success: false, message: '任务已在终止状态' };
    }
    
    this.resourceQuota.stop();
    this.result = {
      success: false,
      error: {
        reason,
        details,
        timestamp: new Date().toISOString()
      }
    };
    
    this.stateMachine.fail(reason, details);
    this.completedAt = new Date().toISOString();
    this.logger.platform(`任务失败: ${reason}`, { details });
    this._recordOperation(operator, 'fail', `任务失败: ${reason}`);
    
    return { success: true, result: this.result };
  }

  timeout(details = null, operator = 'system') {
    if (this.stateMachine.isTerminal()) {
      return { success: false, message: '任务已在终止状态' };
    }
    
    this.resourceQuota.stop();
    this.result = {
      success: false,
      error: {
        reason: FAILURE_REASONS.TIMED_OUT,
        message: '任务执行超时',
        details,
        timestamp: new Date().toISOString()
      }
    };
    
    this.stateMachine.timeout(details);
    this.completedAt = new Date().toISOString();
    this.logger.platform('任务执行超时', { details });
    this._recordOperation(operator, 'timeout', '任务超时');
    
    return { success: true, result: this.result };
  }

  cancel(operator = this.submitter, reason = '用户取消任务') {
    if (this.stateMachine.isTerminal()) {
      return { success: false, message: '任务已在终止状态' };
    }
    
    this.resourceQuota.stop();
    this.result = {
      success: false,
      error: {
        reason: FAILURE_REASONS.CANCELLED_BY_USER,
        message: reason,
        timestamp: new Date().toISOString()
      }
    };
    
    this.stateMachine.cancel(reason, { cancelledBy: operator });
    this.completedAt = new Date().toISOString();
    this.logger.platform(`任务被用户取消: ${reason}`, { cancelledBy: operator });
    this.logger.audit('cancel', operator, { action: 'cancel', reason });
    this._recordOperation(operator, 'cancel', reason);
    
    return { success: true, result: this.result };
  }

  kill(operator = 'admin', reason = '管理员强制终止任务') {
    if (this.stateMachine.isTerminal()) {
      return { success: false, message: '任务已在终止状态' };
    }
    
    this.resourceQuota.stop();
    this.result = {
      success: false,
      error: {
        reason: FAILURE_REASONS.KILLED_BY_ADMIN,
        message: reason,
        timestamp: new Date().toISOString()
      }
    };
    
    this.stateMachine.kill(reason, { killedBy: operator });
    this.completedAt = new Date().toISOString();
    this.logger.platform(`任务被管理员终止: ${reason}`, { killedBy: operator });
    this.logger.audit('kill', operator, { action: 'kill', reason });
    this._recordOperation(operator, 'kill', reason);
    
    return { success: true, result: this.result };
  }

  canWriteResult() {
    return this.stateMachine.canWriteResults();
  }

  checkPermissions(operation, resource = null) {
    let checkResult;
    
    switch (operation) {
      case 'readFile':
        checkResult = this.permissionPolicy.canReadFile(resource);
        break;
      case 'writeFile':
        checkResult = this.permissionPolicy.canWriteFile(resource);
        break;
      case 'network':
        checkResult = this.permissionPolicy.canAccessNetwork();
        break;
      case 'process':
        checkResult = this.permissionPolicy.canAccessProcess();
        break;
      default:
        checkResult = { allowed: false, reason: '未知操作类型' };
    }
    
    if (!checkResult.allowed) {
      this.violations.push({
        type: 'permission',
        operation,
        resource,
        reason: checkResult.reason,
        policy: checkResult.policy,
        timestamp: new Date().toISOString()
      });
      this.logger.platform(`权限违规: ${checkResult.reason}`, {
        operation,
        resource,
        policy: checkResult.policy
      });
    }
    
    return checkResult;
  }

  checkResources() {
    const checkResult = this.resourceQuota.checkAllLimits();
    
    if (checkResult.anyExceeded) {
      this.violations.push({
        type: 'resource',
        violations: checkResult.violations,
        messages: checkResult.messages,
        timestamp: new Date().toISOString()
      });
      this.logger.platform('资源超限', { violations: checkResult.violations });
    }
    
    return checkResult;
  }

  addUserLog(message, meta = {}) {
    this.resourceQuota.incrementLogLines();
    return this.logger.user(message, meta);
  }

  getStatus() {
    const usage = this.resourceQuota.getUsage();
    const progress = this.resourceQuota.getProgress();
    const failureInfo = this.stateMachine.getFailureInfo();
    
    return {
      taskId: this.id,
      name: this.name,
      state: this.stateMachine.getCurrentState(),
      stateDescription: this.stateMachine.getStateDescription(),
      submitter: this.submitter,
      policyType: this.policyType,
      quotaPreset: this.quotaPreset,
      createdAt: this.createdAt,
      submittedAt: this.submittedAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      resourceUsage: usage,
      resourceProgress: progress,
      quotas: this.resourceQuota.getQuotas(),
      failureReason: failureInfo.reason,
      failureDetails: failureInfo.details,
      violations: this.violations,
      canWriteResult: this.canWriteResult()
    };
  }

  getDetailedInfo() {
    return {
      ...this.getStatus(),
      scriptType: this.scriptType,
      parameters: this.parameters,
      policy: this.permissionPolicy.getPolicy(),
      operatorHistory: this.operatorHistory,
      auditRecords: this.logger.getLogs('audit'),
      result: this.result,
      executionErrors: this.executionErrors,
      stateHistory: this.stateMachine.getStateHistory()
    };
  }

  _recordOperation(operator, action, description) {
    const record = {
      operator,
      action,
      description,
      timestamp: new Date().toISOString()
    };
    this.operatorHistory.push(record);
    this.auditRecords.push(record);
  }
}

class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.taskNameIndex = new Map();
    this.userTaskIndex = new Map();
  }

  createTask(options) {
    const task = new Task(options);
    this.tasks.set(task.id, task);
    
    if (!this.taskNameIndex.has(task.name)) {
      this.taskNameIndex.set(task.name, []);
    }
    this.taskNameIndex.get(task.name).push(task.id);
    
    if (!this.userTaskIndex.has(task.submitter)) {
      this.userTaskIndex.set(task.submitter, []);
    }
    this.userTaskIndex.get(task.submitter).push(task.id);
    
    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  hasTask(taskId) {
    return this.tasks.has(taskId);
  }

  checkDuplicateSubmission(name, submitter) {
    const taskIds = this.taskNameIndex.get(name) || [];
    
    for (const taskId of taskIds) {
      const task = this.tasks.get(taskId);
      if (task && task.submitter === submitter && !task.stateMachine.isTerminal()) {
        return {
          isDuplicate: true,
          existingTaskId: taskId,
          existingTaskState: task.stateMachine.getCurrentState()
        };
      }
    }
    
    return { isDuplicate: false };
  }

  listTasks(filters = {}) {
    let tasks = Array.from(this.tasks.values());
    
    if (filters.submitter) {
      tasks = tasks.filter(t => t.submitter === filters.submitter);
    }
    
    if (filters.state) {
      tasks = tasks.filter(t => t.stateMachine.getCurrentState() === filters.state);
    }
    
    if (filters.policyType) {
      tasks = tasks.filter(t => t.policyType === filters.policyType);
    }
    
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      tasks = tasks.filter(t => new Date(t.createdAt) >= startDate);
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      tasks = tasks.filter(t => new Date(t.createdAt) <= endDate);
    }
    
    return tasks.map(t => t.getStatus());
  }

  getTaskLogs(taskId, typeFilter = null) {
    const task = this.getTask(taskId);
    if (!task) return null;
    
    return task.logger.getLogs(typeFilter);
  }

  exportTaskResult(taskId) {
    const task = this.getTask(taskId);
    if (!task) return null;
    
    return {
      taskId: task.id,
      name: task.name,
      state: task.stateMachine.getCurrentState(),
      result: task.result,
      logs: task.logger.getLogs(),
      status: task.getStatus(),
      exportedAt: new Date().toISOString()
    };
  }

  submitAndQueue(taskId) {
    const task = this.getTask(taskId);
    if (!task) return { success: false, message: '任务不存在' };
    
    const submitResult = task.submit();
    if (!submitResult.success) return submitResult;
    
    const enqueueResult = task.enqueue();
    if (!enqueueResult.success) return enqueueResult;
    
    return {
      success: true,
      message: '任务提交并加入队列',
      taskId
    };
  }

  static getPolicyTypes() {
    return POLICY_TYPES;
  }

  static getQuotaPresets() {
    return QUOTA_PRESETS;
  }
}

module.exports = {
  Task,
  TaskManager,
  TASK_STATES,
  FAILURE_REASONS,
  POLICY_TYPES,
  QUOTA_PRESETS
};

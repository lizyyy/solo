const { v4: uuidv4 } = require('uuid');

const TASK_TYPES = {
  REALTIME_EXPORT: 'realtime_export',
  BATCH_PROCESSING: 'batch_processing',
  COMPENSATION: 'compensation',
  REPORT_GENERATION: 'report_generation'
};

const TENANT_LEVELS = {
  GOLD: 'gold',
  SILVER: 'silver',
  BRONZE: 'bronze',
  GUEST: 'guest'
};

const TASK_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  DELAYED: 'delayed',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

class Task {
  constructor({
    taskId,
    tenantId,
    taskType,
    tenantLevel = TENANT_LEVELS.GUEST,
    priority = 0,
    deadline = null,
    resourceEstimate = { cpu: 0, memory: 0, duration: 0 },
    payload = {},
    idempotencyKey = null
  }) {
    this.taskId = taskId || uuidv4();
    this.tenantId = tenantId;
    this.taskType = taskType;
    this.tenantLevel = tenantLevel;
    this.userPriority = priority;
    this.deadline = deadline ? new Date(deadline) : null;
    this.resourceEstimate = resourceEstimate;
    this.payload = payload;
    this.idempotencyKey = idempotencyKey;
    
    this.status = TASK_STATUSES.PENDING;
    this.effectivePriority = 0;
    this.submittedAt = new Date();
    this.startedAt = null;
    this.completedAt = null;
    this.waitTimeMs = 0;
    this.executionTimeMs = 0;
    this.suspendedCount = 0;
    this.resumedCount = 0;
    this.arbitrationReason = null;
    this.resourcesAllocated = { cpu: 0, memory: 0 };
    this.history = [];
  }

  addHistory(event, reason, details = {}) {
    this.history.push({
      timestamp: new Date(),
      event,
      reason,
      details
    });
  }

  calculateWaitTime() {
    if (this.status === TASK_STATUSES.PENDING || this.status === TASK_STATUSES.PAUSED || this.status === TASK_STATUSES.DELAYED) {
      this.waitTimeMs = Date.now() - this.submittedAt.getTime();
    }
    return this.waitTimeMs;
  }

  isPastDeadline() {
    if (!this.deadline) return false;
    return new Date() > this.deadline;
  }

  toJSON() {
    return {
      taskId: this.taskId,
      tenantId: this.tenantId,
      taskType: this.taskType,
      tenantLevel: this.tenantLevel,
      userPriority: this.userPriority,
      effectivePriority: this.effectivePriority,
      deadline: this.deadline ? this.deadline.toISOString() : null,
      resourceEstimate: this.resourceEstimate,
      resourcesAllocated: this.resourcesAllocated,
      status: this.status,
      submittedAt: this.submittedAt.toISOString(),
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      completedAt: this.completedAt ? this.completedAt.toISOString() : null,
      waitTimeMs: this.calculateWaitTime(),
      executionTimeMs: this.executionTimeMs,
      suspendedCount: this.suspendedCount,
      resumedCount: this.resumedCount,
      arbitrationReason: this.arbitrationReason,
      idempotencyKey: this.idempotencyKey,
      history: this.history
    };
  }
}

module.exports = {
  Task,
  TASK_TYPES,
  TENANT_LEVELS,
  TASK_STATUSES
};

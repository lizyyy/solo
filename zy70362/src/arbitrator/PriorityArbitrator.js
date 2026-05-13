const { Task, TASK_TYPES, TENANT_LEVELS, TASK_STATUSES } = require('../models/Task');

const ARBITRATION_REASONS = {
  VIP_PREEMPT: 'VIP实时任务抢占执行',
  BATCH_PAUSED: '低优先级批处理任务被暂停',
  COMPENSATION_ESCALATED: '补偿任务等待超时，优先级提升',
  NORMAL_QUEUE: '普通排队执行',
  RESOURCE_SHORTAGE: '资源不足，进入延迟队列',
  DEADLINE_EXCEEDED: '已超过截止时间，执行抢占',
  IDEMPOTENT: '重复任务，返回已有结果',
  PREEMPTED_BY_HIGHER: '被更高优先级任务抢占',
  RESUMED_AFTER_PREEMPT: '抢占结束后恢复执行'
};

const TASK_TYPE_WEIGHTS = {
  [TASK_TYPES.REALTIME_EXPORT]: 100,
  [TASK_TYPES.REPORT_GENERATION]: 70,
  [TASK_TYPES.BATCH_PROCESSING]: 20,
  [TASK_TYPES.COMPENSATION]: 10
};

const TENANT_LEVEL_WEIGHTS = {
  [TENANT_LEVELS.GOLD]: 100,
  [TENANT_LEVELS.SILVER]: 60,
  [TENANT_LEVELS.BRONZE]: 30,
  [TENANT_LEVELS.GUEST]: 0
};

const COMPENSATION_ESCALATION_THRESHOLD_MS = 5 * 60 * 1000;
const COMPENSATION_MAX_ESCALATION = 80;

class PriorityArbitrator {
  constructor(maxResources = { cpu: 8, memory: 16 }) {
    this.maxResources = maxResources;
    this.tasks = new Map();
    this.pendingQueue = [];
    this.runningTasks = [];
    this.pausedTasks = [];
    this.delayedTasks = [];
    this.idempotencyMap = new Map();
    this.preemptionEnabled = true;
  }

  calculateEffectivePriority(task) {
    let priority = 0;
    
    priority += TASK_TYPE_WEIGHTS[task.taskType] || 0;
    priority += TENANT_LEVEL_WEIGHTS[task.tenantLevel] || 0;
    priority += task.userPriority * 5;
    
    const waitTime = task.calculateWaitTime();
    const ageBonus = Math.min(Math.floor(waitTime / 10000) * 2, 30);
    priority += ageBonus;
    
    if (task.taskType === TASK_TYPES.COMPENSATION) {
      const escalationAmount = Math.floor(waitTime / COMPENSATION_ESCALATION_THRESHOLD_MS) * 20;
      priority += Math.min(escalationAmount, COMPENSATION_MAX_ESCALATION);
      
      if (escalationAmount > 0) {
        task.arbitrationReason = ARBITRATION_REASONS.COMPENSATION_ESCALATED;
        task.addHistory('priority_escalated', ARBITRATION_REASONS.COMPENSATION_ESCALATED, {
          escalatedBy: Math.min(escalationAmount, COMPENSATION_MAX_ESCALATION),
          waitTimeMs: waitTime
        });
      }
    }
    
    if (task.deadline) {
      const timeUntilDeadline = task.deadline.getTime() - Date.now();
      if (timeUntilDeadline < 0) {
        priority += 100;
        task.arbitrationReason = ARBITRATION_REASONS.DEADLINE_EXCEEDED;
      } else if (timeUntilDeadline < 60000) {
        priority += 50;
      } else if (timeUntilDeadline < 300000) {
        priority += 20;
      }
    }
    
    task.effectivePriority = priority;
    return priority;
  }

  hasEnoughResources(resourceEstimate) {
    const usedCpu = this.runningTasks.reduce((sum, t) => sum + t.resourcesAllocated.cpu, 0);
    const usedMemory = this.runningTasks.reduce((sum, t) => sum + t.resourcesAllocated.memory, 0);
    
    const newCpu = usedCpu + resourceEstimate.cpu;
    const newMemory = usedMemory + resourceEstimate.memory;
    
    return newCpu <= this.maxResources.cpu && newMemory <= this.maxResources.memory;
  }

  getAvailableResources() {
    const usedCpu = this.runningTasks.reduce((sum, t) => sum + t.resourcesAllocated.cpu, 0);
    const usedMemory = this.runningTasks.reduce((sum, t) => sum + t.resourcesAllocated.memory, 0);
    
    return {
      cpu: this.maxResources.cpu - usedCpu,
      memory: this.maxResources.memory - usedMemory
    };
  }

  canPreempt(task) {
    if (!this.preemptionEnabled) return false;
    
    const taskPriority = this.calculateEffectivePriority(task);
    
    const preemptableTasks = this.runningTasks.filter(t => {
      const tPriority = this.calculateEffectivePriority(t);
      const isLowPriority = t.taskType === TASK_TYPES.BATCH_PROCESSING || t.taskType === TASK_TYPES.COMPENSATION;
      const tenantLow = t.tenantLevel === TENANT_LEVELS.BRONZE || t.tenantLevel === TENANT_LEVELS.GUEST;
      return (isLowPriority || tenantLow) && taskPriority > tPriority + 30;
    });
    
    if (preemptableTasks.length === 0) return { canPreempt: false };
    
    const preemptTask = preemptableTasks.sort((a, b) => {
      const aPriority = this.calculateEffectivePriority(a);
      const bPriority = this.calculateEffectivePriority(b);
      return aPriority - bPriority;
    })[0];
    
    return {
      canPreempt: true,
      taskToPreempt: preemptTask,
      reason: taskPriority > TASK_TYPE_WEIGHTS[TASK_TYPES.REALTIME_EXPORT] + 50 
        ? ARBITRATION_REASONS.VIP_PREEMPT 
        : '更高优先级任务抢占'
    };
  }

  pauseTask(task, reason) {
    const index = this.runningTasks.findIndex(t => t.taskId === task.taskId);
    if (index !== -1) {
      this.runningTasks.splice(index, 1);
    }
    
    task.status = TASK_STATUSES.PAUSED;
    task.suspendedCount++;
    task.executionTimeMs += Date.now() - task.startedAt.getTime();
    task.startedAt = null;
    task.arbitrationReason = reason;
    task.addHistory('paused', reason, {
      pausedAt: new Date().toISOString()
    });
    
    this.pausedTasks.push(task);
    
    return task;
  }

  resumeTask(task) {
    const index = this.pausedTasks.findIndex(t => t.taskId === task.taskId);
    if (index !== -1) {
      this.pausedTasks.splice(index, 1);
    }
    
    task.status = TASK_STATUSES.RUNNING;
    task.resumedCount++;
    task.startedAt = new Date();
    task.arbitrationReason = ARBITRATION_REASONS.RESUMED_AFTER_PREEMPT;
    task.addHistory('resumed', ARBITRATION_REASONS.RESUMED_AFTER_PREEMPT, {
      resumedAt: new Date().toISOString()
    });
    
    this.runningTasks.push(task);
    
    return task;
  }

  submitTask(taskData) {
    if (taskData.idempotencyKey) {
      const existingTaskId = this.idempotencyMap.get(taskData.idempotencyKey);
      if (existingTaskId) {
        const existingTask = this.tasks.get(existingTaskId);
        if (existingTask) {
          return {
            task: existingTask,
            isNew: false,
            reason: ARBITRATION_REASONS.IDEMPOTENT
          };
        }
      }
    }
    
    const task = new Task(taskData);
    
    if (taskData.idempotencyKey) {
      this.idempotencyMap.set(taskData.idempotencyKey, task.taskId);
    }
    
    this.tasks.set(task.taskId, task);
    this.pendingQueue.push(task);
    task.addHistory('submitted', '任务已提交进入待执行队列', {
      queuePosition: this.pendingQueue.length
    });
    
    return {
      task,
      isNew: true,
      reason: ARBITRATION_REASONS.NORMAL_QUEUE
    };
  }

  runArbitration() {
    this.pendingQueue.forEach(task => this.calculateEffectivePriority(task));
    this.pausedTasks.forEach(task => this.calculateEffectivePriority(task));
    
    this.pendingQueue.sort((a, b) => b.effectivePriority - a.effectivePriority);
    this.pausedTasks.sort((a, b) => b.effectivePriority - a.effectivePriority);
    
    const results = [];
    
    for (let i = 0; i < this.pendingQueue.length; ) {
      const task = this.pendingQueue[i];
      
      if (this.hasEnoughResources(task.resourceEstimate)) {
        this.pendingQueue.splice(i, 1);
        task.status = TASK_STATUSES.RUNNING;
        task.startedAt = new Date();
        task.resourcesAllocated = { ...task.resourceEstimate };
        task.arbitrationReason = task.effectivePriority > 100 ? ARBITRATION_REASONS.VIP_PREEMPT : ARBITRATION_REASONS.NORMAL_QUEUE;
        task.addHistory('started', '任务开始执行', {
          resources: task.resourcesAllocated
        });
        this.runningTasks.push(task);
        
        results.push({
          taskId: task.taskId,
          action: 'started',
          reason: task.arbitrationReason,
          effectivePriority: task.effectivePriority
        });
        continue;
      }
      
      if (this.preemptionEnabled) {
        const preemptionResult = this.canPreempt(task);
        
        if (preemptionResult.canPreempt) {
          const preemptedTask = this.pauseTask(preemptionResult.taskToPreempt, ARBITRATION_REASONS.PREEMPTED_BY_HIGHER);
          
          this.pendingQueue.splice(i, 1);
          task.status = TASK_STATUSES.RUNNING;
          task.startedAt = new Date();
          task.resourcesAllocated = { ...task.resourceEstimate };
          task.arbitrationReason = preemptionResult.reason;
          task.addHistory('started', preemptionResult.reason, {
            resources: task.resourcesAllocated,
            preemptedTaskId: preemptedTask.taskId
          });
          this.runningTasks.push(task);
          
          results.push({
            taskId: task.taskId,
            action: 'started',
            reason: preemptionResult.reason,
            preemptedTaskId: preemptedTask.taskId,
            effectivePriority: task.effectivePriority
          });
          continue;
        }
      }
      
      i++;
    }
    
    for (let i = 0; i < this.pausedTasks.length; ) {
      const task = this.pausedTasks[i];
      
      if (this.hasEnoughResources(task.resourcesAllocated)) {
        this.resumeTask(task);
        
        results.push({
          taskId: task.taskId,
          action: 'resumed',
          reason: ARBITRATION_REASONS.RESUMED_AFTER_PREEMPT,
          effectivePriority: task.effectivePriority
        });
      }
      
      i++;
    }
    
    return results;
  }

  completeTask(taskId) {
    const index = this.runningTasks.findIndex(t => t.taskId === taskId);
    if (index === -1) return null;
    
    const task = this.runningTasks[index];
    this.runningTasks.splice(index, 1);
    
    task.status = TASK_STATUSES.COMPLETED;
    task.completedAt = new Date();
    task.executionTimeMs += Date.now() - task.startedAt.getTime();
    task.addHistory('completed', '任务执行完成', {
      totalExecutionTimeMs: task.executionTimeMs
    });
    
    this.runArbitration();
    
    return task;
  }

  failTask(taskId, error = null) {
    const index = this.runningTasks.findIndex(t => t.taskId === taskId);
    if (index === -1) return null;
    
    const task = this.runningTasks[index];
    this.runningTasks.splice(index, 1);
    
    task.status = TASK_STATUSES.FAILED;
    task.completedAt = new Date();
    task.executionTimeMs += Date.now() - task.startedAt.getTime();
    task.addHistory('failed', '任务执行失败', {
      error: error || '未知错误',
      totalExecutionTimeMs: task.executionTimeMs
    });
    
    this.runArbitration();
    
    return task;
  }

  getTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      this.calculateEffectivePriority(task);
      task.calculateWaitTime();
    }
    return task;
  }

  getAllTasks(status = null) {
    const allTasks = Array.from(this.tasks.values());
    
    if (status) {
      return allTasks
        .filter(t => t.status === status)
        .map(t => {
          this.calculateEffectivePriority(t);
          t.calculateWaitTime();
          return t;
        });
    }
    
    return allTasks.map(t => {
      this.calculateEffectivePriority(t);
      t.calculateWaitTime();
      return t;
    });
  }

  getQueueStatistics() {
    return {
      total: this.tasks.size,
      pending: this.pendingQueue.length,
      running: this.runningTasks.length,
      paused: this.pausedTasks.length,
      delayed: this.delayedTasks.length,
      availableResources: this.getAvailableResources(),
      maxResources: this.maxResources
    };
  }
}

module.exports = PriorityArbitrator;

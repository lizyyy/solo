const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { BackgroundTask } = require('../models');
const { TaskStatus, TaskType } = require('../constants/status');
const { FineService, FineRuleService } = require('./FineService');
const { StateConsistencyService } = require('./StateConsistencyService');

class TaskExecutionError extends Error {
  constructor(message, retryable = true, details = {}) {
    super(message);
    this.name = 'TaskExecutionError';
    this.retryable = retryable;
    this.details = details;
  }
}

const taskHandlers = {
  [TaskType.ISSUE_FINE]: async (task) => {
    const { applicationId, ruleCode, context } = task.payload;
    return await FineService.issueFine(
      applicationId,
      ruleCode,
      context || {},
      `system:task:${task.id}`
    );
  },

  [TaskType.RECALCULATE_STATUS]: async (task) => {
    const { applicationId } = task.payload;
    return await StateConsistencyService.verifyAndRepairApplication(
      applicationId,
      `system:task:${task.id}`
    );
  },

  [TaskType.CHECK_OVERTIME]: async (task) => {
    const { applicationId } = task.payload;
    return await FineService.checkAndIssueOvertimeFine(
      applicationId,
      `system:task:${task.id}`
    );
  }
};

class TaskService {
  static async createTask(taskType, targetType, targetId, payload = {}, priority = 0, maxRetries = 5) {
    return await BackgroundTask.create({
      taskType,
      targetType,
      targetId,
      status: TaskStatus.PENDING,
      payload,
      retryCount: 0,
      maxRetries,
      priority,
      version: 1
    });
  }

  static async getNextPendingTask() {
    return await BackgroundTask.findOne({
      where: {
        status: {
          [Op.or]: [
            TaskStatus.PENDING,
            TaskStatus.RETRYABLE
          ]
        },
        [Op.or]: [
          { nextRetryAt: null },
          { nextRetryAt: { [Op.lte]: new Date() } }
        ]
      },
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'ASC']
      ]
    });
  }

  static calculateBackoff(retryCount) {
    const baseDelay = 1000;
    const maxDelay = 3600000;
    const delay = baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, maxDelay);
  }

  static async executeTask(task) {
    if (!taskHandlers[task.taskType]) {
      throw new TaskExecutionError(
        `Unknown task type: ${task.taskType}`,
        false
      );
    }

    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    task.retryCount = task.retryCount + 1;
    await task.save();

    try {
      const handler = taskHandlers[task.taskType];
      const result = await handler(task);

      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.result = result;
      task.nextRetryAt = null;
      await task.save();

      return { success: true, task, result };
    } catch (error) {
      const isRetryable = error.retryable !== false;
      const canRetry = task.retryCount < task.maxRetries;

      task.errorMessage = error.message;
      task.errorStack = error.stack;
      task.failedAt = new Date();

      if (isRetryable && canRetry) {
        const backoffMs = this.calculateBackoff(task.retryCount);
        task.status = TaskStatus.RETRYABLE;
        task.nextRetryAt = new Date(Date.now() + backoffMs);
      } else {
        task.status = TaskStatus.FAILED;
        task.nextRetryAt = null;
      }

      await task.save();

      return {
        success: false,
        task,
        error,
        willRetry: task.status === TaskStatus.RETRYABLE
      };
    }
  }

  static async runPendingTasks(batchSize = 10) {
    const results = [];

    for (let i = 0; i < batchSize; i++) {
      const task = await this.getNextPendingTask();
      if (!task) break;

      const result = await this.executeTask(task);
      results.push(result);
    }

    return results;
  }

  static async retryTask(taskId) {
    const task = await BackgroundTask.findByPk(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status !== TaskStatus.FAILED) {
      throw new Error('只有失败的任务才能手动重试');
    }

    task.status = TaskStatus.RETRYABLE;
    task.retryCount = 0;
    task.nextRetryAt = new Date();
    task.errorMessage = null;
    task.errorStack = null;
    task.failedAt = null;
    task.result = null;

    await task.save();

    return task;
  }

  static async listFailedTasks() {
    return await BackgroundTask.findAll({
      where: {
        status: TaskStatus.FAILED
      },
      order: [['failedAt', 'DESC']]
    });
  }

  static async listRetryableTasks() {
    return await BackgroundTask.findAll({
      where: {
        status: TaskStatus.RETRYABLE
      },
      order: [['nextRetryAt', 'ASC']]
    });
  }

  static async getTask(taskId) {
    return await BackgroundTask.findByPk(taskId);
  }

  static async getTaskHistory(targetType, targetId) {
    return await BackgroundTask.findAll({
      where: {
        targetType,
        targetId
      },
      order: [['createdAt', 'DESC']]
    });
  }

  static registerHandler(taskType, handler) {
    taskHandlers[taskType] = handler;
  }
}

module.exports = {
  TaskService,
  TaskExecutionError,
  taskHandlers
};

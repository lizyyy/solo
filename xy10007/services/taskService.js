const { Task } = require('../models');
const RefundService = require('./refundService');
const { v4: uuidv4 } = require('uuid');

class TaskService {
  static TASK_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    MAX_RETRY_REACHED: 'max_retry_reached'
  };

  static TASK_NAMES = {
    EXECUTE_REFUND: 'execute_refund'
  };

  static async createTask(options) {
    const { name, payload, priority = 0, maxRetry = 5, retryDelay = 3000 } = options;

    return await Task.create({
      name,
      payload: JSON.stringify(payload),
      status: this.TASK_STATUS.PENDING,
      priority,
      retryCount: 0,
      maxRetry,
      retryDelay
    });
  }

  static async getPendingTasks(limit = 10) {
    return await Task.findAll({
      where: {
        status: this.TASK_STATUS.PENDING,
        runAt: null
      },
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'ASC']
      ],
      limit,
      lock: true
    });
  }

  static async processTask(task) {
    const t = await Task.sequelize.transaction();

    try {
      task.status = this.TASK_STATUS.PROCESSING;
      await task.save({ transaction: t });

      const payload = JSON.parse(task.payload);

      let result;
      switch (task.name) {
        case this.TASK_NAMES.EXECUTE_REFUND:
          result = await this.executeRefundTask(payload);
          break;
        default:
          throw new Error(`Unknown task type: ${task.name}`);
      }

      if (result.success) {
        task.status = this.TASK_STATUS.COMPLETED;
      } else {
        throw new Error(result.message);
      }

      await task.save({ transaction: t });
      await t.commit();

      return { success: true, result };
    } catch (error) {
      await t.rollback();

      task.retryCount++;
      task.lastError = error.message;

      if (task.retryCount >= task.maxRetry) {
        task.status = this.TASK_STATUS.MAX_RETRY_REACHED;
      } else {
        task.status = this.TASK_STATUS.FAILED;
        task.runAt = new Date(Date.now() + task.retryDelay * Math.pow(2, task.retryCount - 1));
      }

      await task.save();

      return { success: false, error: error.message };
    }
  }

  static async executeRefundTask(payload) {
    const { refundId, operatorId, operatorName } = payload;
    const executeIdempotencyKey = uuidv4();

    return await RefundService.executeRefund({
      refundId,
      operatorId,
      operatorName,
      executeIdempotencyKey
    });
  }

  static async retryFailedTasks() {
    const now = new Date();
    
    const failedTasks = await Task.findAll({
      where: {
        status: this.TASK_STATUS.FAILED,
        runAt: { lte: now }
      },
      order: [
        ['priority', 'DESC'],
        ['runAt', 'ASC']
      ]
    });

    const results = [];
    for (const task of failedTasks) {
      const result = await this.processTask(task);
      results.push({ taskId: task.id, result });
    }

    return results;
  }

  static async retryTaskById(taskId) {
    const task = await Task.findByPk(taskId);
    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    if (task.status !== this.TASK_STATUS.FAILED && task.status !== this.TASK_STATUS.MAX_RETRY_REACHED) {
      return { success: false, message: `Task status ${task.status} cannot be retried` };
    }

    task.status = this.TASK_STATUS.PENDING;
    task.runAt = null;
    if (task.status === this.TASK_STATUS.MAX_RETRY_REACHED) {
      task.retryCount = 0;
    }
    await task.save();

    return { success: true, message: 'Task queued for retry' };
  }

  static async getTasks(options = {}) {
    const { limit = 20, offset = 0, status, name } = options;
    const where = {};

    if (status) where.status = status;
    if (name) where.name = name;

    return await Task.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  static startScheduler(interval = 30000) {
    setInterval(async () => {
      try {
        await this.retryFailedTasks();
      } catch (error) {
        console.error('Task scheduler error:', error);
      }
    }, interval);
  }
}

module.exports = TaskService;
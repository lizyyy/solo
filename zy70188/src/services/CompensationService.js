const { Op } = require('sequelize');
const { CompensationTask } = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { 
  CompensationTaskExistsError, 
  ResourceNotFoundError 
} = require('../utils/errors');

const receiptAssignmentService = require('./ReceiptAssignmentService');
const voidService = require('./VoidService');
const reprintService = require('./ReprintService');

class CompensationService {
  async createCompensationTask(data, operator = {}) {
    const {
      task_type,
      business_key,
      receipt_number,
      window_id,
      original_request,
      failed_reason,
      max_retry = 5
    } = data;

    const existingTask = await CompensationTask.findOne({
      where: {
        business_key,
        status: { [Op.in]: ['pending', 'processing'] }
      }
    });

    if (existingTask) {
      throw new CompensationTaskExistsError(business_key);
    }

    const task = await CompensationTask.create({
      task_type,
      business_key,
      receipt_number,
      window_id,
      original_request: JSON.stringify(original_request),
      failed_reason,
      max_retry,
      next_retry_at: new Date()
    });

    await createAuditLog({
      action: actions.CREATE_COMPENSATION,
      actionDescription: `创建补偿任务「${task_type}」，业务标识：${business_key}`,
      module: modules.COMPENSATION,
      receiptNumber: receipt_number,
      windowId: window_id,
      operatorId: operator.id,
      operatorName: operator.name,
      afterData: { taskId: task.id }
    });

    logger.info(`创建补偿任务成功: ${task.id}`);

    return task;
  }

  async listCompensationTasks(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      status,
      task_type,
      business_key
    } = params;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (status) where.status = status;
    if (task_type) where.task_type = task_type;
    if (business_key) where.business_key = business_key;

    const { count, rows } = await CompensationTask.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    return {
      list: rows.map(r => r.toJSON()),
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    };
  }

  async executeCompensation(taskId, operator = {}) {
    const task = await CompensationTask.findByPk(taskId);
    if (!task) {
      throw new ResourceNotFoundError('补偿任务不存在');
    }

    if (task.status === 'completed') {
      return {
        success: true,
        message: '该补偿任务已完成'
      };
    }

    if (task.status === 'cancelled') {
      return {
        success: false,
        message: '该补偿任务已取消'
      };
    }

    await task.update({
      status: 'processing',
      last_retry_at: new Date(),
      retry_count: task.retry_count + 1
    });

    try {
      const requestData = JSON.parse(task.original_request);
      let result;

      switch (task.task_type) {
        case 'assign':
          result = await this.executeAssignCompensation(requestData, operator);
          break;
        case 'void':
          result = await this.executeVoidCompensation(requestData, operator);
          break;
        case 'reprint':
          result = await this.executeReprintCompensation(requestData, operator);
          break;
        default:
          throw new Error(`不支持的补偿类型: ${task.task_type}`);
      }

      await task.update({
        status: 'completed',
        completed_at: new Date(),
        result_message: JSON.stringify(result)
      });

      await createAuditLog({
        action: actions.EXECUTE_COMPENSATION,
        actionDescription: `执行补偿任务成功，业务标识：${task.business_key}`,
        module: modules.COMPENSATION,
        receiptNumber: task.receipt_number,
        operatorId: operator.id,
        operatorName: operator.name,
        afterData: { taskId, result }
      });

      logger.info(`补偿任务执行成功: ${taskId}`);

      return {
        success: true,
        message: '补偿任务执行成功',
        result
      };

    } catch (error) {
      logger.error(`补偿任务执行失败: ${taskId}`, error);

      const nextRetryCount = task.retry_count + 1;
      const isExceededMax = nextRetryCount >= task.max_retry;

      await task.update({
        status: isExceededMax ? 'failed' : 'pending',
        result_message: error.message,
        next_retry_at: isExceededMax ? null : this.calculateNextRetryTime(nextRetryCount)
      });

      return {
        success: false,
        message: isExceededMax 
          ? '补偿任务执行失败，已超过最大重试次数' 
          : `补偿任务执行失败，将在下次重试`,
        retry_count: nextRetryCount,
        max_retry: task.max_retry,
        error: error.message
      };
    }
  }

  async executeAssignCompensation(requestData, operator) {
    return await receiptAssignmentService.assignReceipt(requestData, operator);
  }

  async executeVoidCompensation(requestData, operator) {
    return await voidService.voidReceipt(requestData, operator);
  }

  async executeReprintCompensation(requestData, operator) {
    return await reprintService.reprintReceipt(requestData, operator);
  }

  calculateNextRetryTime(retryCount) {
    const baseDelay = 60000;
    const delay = baseDelay * Math.pow(2, retryCount);
    return new Date(Date.now() + delay);
  }

  async cancelCompensation(taskId, operator = {}) {
    const task = await CompensationTask.findByPk(taskId);
    if (!task) {
      throw new ResourceNotFoundError('补偿任务不存在');
    }

    await task.update({
      status: 'cancelled',
      result_message: '用户取消'
    });

    logger.info(`取消补偿任务: ${taskId}`);

    return {
      success: true,
      message: '补偿任务已取消'
    };
  }

  async getPendingCompensationTasks() {
    const tasks = await CompensationTask.findAll({
      where: {
        status: 'pending',
        next_retry_at: { [Op.lte]: new Date() }
      },
      order: [['next_retry_at', 'ASC']]
    });

    return tasks;
  }

  async getCompensationStats() {
    const totalTasks = await CompensationTask.count();
    const pendingCount = await CompensationTask.count({ where: { status: 'pending' } });
    const processingCount = await CompensationTask.count({ where: { status: 'processing' } });
    const completedCount = await CompensationTask.count({ where: { status: 'completed' } });
    const failedCount = await CompensationTask.count({ where: { status: 'failed' } });
    const cancelledCount = await CompensationTask.count({ where: { status: 'cancelled' } });

    return {
      total_tasks: totalTasks,
      pending: pendingCount,
      processing: processingCount,
      completed: completedCount,
      failed: failedCount,
      cancelled: cancelledCount
    };
  }
}

module.exports = new CompensationService();

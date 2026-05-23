const logger = require('../config/logger');
const { CompensationQueue, LossRecord } = require('../models');
const { compensationQueue } = require('../config/queue');
const config = require('../config');
const { Op } = require('sequelize');

class QueueService {
  static generateQueueNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `Q${dateStr}${random}`;
  }

  static async addJob(jobType, payload, options = {}) {
    const queueNo = this.generateQueueNo();
    const maxRetryCount = options.maxRetryCount || config.queue.maxRetryTimes;

    const queueItem = await CompensationQueue.create({
      queueNo,
      jobType,
      payload,
      status: 'pending',
      maxRetryCount,
      deliveryNo: payload.deliveryNo,
      supplierId: payload.supplierId,
      lossRecordId: payload.lossRecordId,
    });

    const bullJob = await compensationQueue.add(
      {
        queueId: queueItem.id,
        queueNo,
        jobType,
        payload,
      },
      {
        jobId: queueItem.id,
        attempts: maxRetryCount,
        delay: options.delay || 0,
      }
    );

    queueItem.bullJobId = bullJob.id;
    await queueItem.save();

    logger.info(`任务已加入队列: ${queueNo}, 类型: ${jobType}, Bull Job ID: ${bullJob.id}`);
    return queueItem;
  }

  static async processJob(queueId) {
    const queueItem = await CompensationQueue.findByPk(queueId);
    if (!queueItem) {
      throw new Error(`队列任务不存在: ${queueId}`);
    }

    if (queueItem.status !== 'pending' && queueItem.status !== 'waiting_retry') {
      throw new Error(`任务状态不允许处理: ${queueItem.status}`);
    }

    await queueItem.update({
      status: 'processing',
    });

    return queueItem;
  }

  static async markJobSuccess(queueId, result = {}) {
    const queueItem = await CompensationQueue.findByPk(queueId);
    if (!queueItem) {
      throw new Error(`队列任务不存在: ${queueId}`);
    }

    await queueItem.update({
      status: 'success',
      payload: { ...queueItem.payload, result },
    });

    logger.info(`任务成功: ${queueItem.queueNo}`);
    return queueItem;
  }

  static async markJobFailed(queueId, error, isRetryable = true) {
    const queueItem = await CompensationQueue.findByPk(queueId);
    if (!queueItem) {
      throw new Error(`队列任务不存在: ${queueId}`);
    }

    const retryCount = queueItem.retryCount + 1;
    const errorHistory = [...(queueItem.errorHistory || []), {
      retryCount,
      error: error.message,
      stack: error.stack,
      timestamp: new Date(),
    }];

    let newStatus = 'waiting_retry';
    let nextRetryAt = null;

    if (!isRetryable || retryCount >= queueItem.maxRetryCount) {
      newStatus = 'permanent_failed';
    } else {
      nextRetryAt = new Date(Date.now() + config.queue.retryDelayMs * retryCount);
    }

    await queueItem.update({
      status: newStatus,
      retryCount,
      lastError: error.message,
      lastErrorAt: new Date(),
      errorHistory,
      nextRetryAt,
    });

    logger.warn(`任务失败: ${queueItem.queueNo}, 重试次数: ${retryCount}, 新状态: ${newStatus}`);
    return queueItem;
  }

  static async markWaitingManual(queueId, handleNote = '') {
    const queueItem = await CompensationQueue.findByPk(queueId);
    if (!queueItem) {
      throw new Error(`队列任务不存在: ${queueId}`);
    }

    await queueItem.update({
      status: 'waiting_manual',
      handleNote,
    });

    logger.info(`任务转入人工处理: ${queueItem.queueNo}`);
    return queueItem;
  }

  static async manualHandle(queueId, handledBy, handleNote, action) {
    const queueItem = await CompensationQueue.findByPk(queueId);
    if (!queueItem) {
      throw new Error(`队列任务不存在: ${queueId}`);
    }

    if (queueItem.status !== 'waiting_manual' && queueItem.status !== 'permanent_failed') {
      throw new Error(`只有等人工或永久失败状态才能人工处理，当前状态: ${queueItem.status}`);
    }

    switch (action) {
      case 'retry':
        await queueItem.update({
          status: 'pending',
          retryCount: 0,
          nextRetryAt: null,
          handledBy,
          handledAt: new Date(),
          handleNote,
        });
        await this.addJob(queueItem.jobType, queueItem.payload, {
          maxRetryCount: queueItem.maxRetryCount,
        });
        break;
      case 'close':
        await queueItem.update({
          status: 'closed',
          handledBy,
          handledAt: new Date(),
          handleNote,
          closedBy: handledBy,
          closedAt: new Date(),
          closeReason: '人工关闭',
        });
        break;
      case 'compensate':
        await queueItem.update({
          status: 'success',
          handledBy,
          handledAt: new Date(),
          handleNote,
          compensationAmount: queueItem.payload?.compensationAmount || 0,
          compensatedAt: new Date(),
        });
        break;
      default:
        throw new Error(`不支持的操作: ${action}`);
    }

    logger.info(`人工处理完成: ${queueItem.queueNo}, 操作: ${action}`);
    return queueItem;
  }

  static async submitExternalReceipt(queueId, receiptId, receiptData) {
    const queueItem = await CompensationQueue.findByPk(queueId);
    if (!queueItem) {
      throw new Error(`队列任务不存在: ${queueId}`);
    }

    await queueItem.update({
      externalReceiptId: receiptId,
      externalReceiptData: receiptData,
      status: 'success',
      compensatedAt: new Date(),
    });

    logger.info(`外部回执已提交: ${queueItem.queueNo}, 回执ID: ${receiptId}`);
    return queueItem;
  }

  static async recoverJobsOnStartup() {
    logger.info('开始恢复队列任务...');

    const pendingJobs = await CompensationQueue.findAll({
      where: {
        status: { [Op.in]: ['pending', 'processing', 'waiting_retry'] },
      },
    });

    logger.info(`找到 ${pendingJobs.length} 个需要恢复的任务`);

    for (const job of pendingJobs) {
      try {
        const bullJob = await compensationQueue.getJob(job.id);
        if (!bullJob || await bullJob.isCompleted() || await bullJob.isFailed()) {
          logger.info(`重新加入队列: ${job.queueNo}`);
          await this.addJob(job.jobType, job.payload, {
            maxRetryCount: job.maxRetryCount,
            delay: job.status === 'waiting_retry' ? config.queue.retryDelayMs : 0,
          });
        }
      } catch (error) {
        logger.error(`恢复任务失败 ${job.queueNo}:`, error);
      }
    }

    logger.info('队列任务恢复完成');
  }

  static async getQueueStats() {
    const stats = await CompensationQueue.findAll({
      attributes: ['status', 'jobType', [CompensationQueue.sequelize.fn('COUNT', CompensationQueue.sequelize.col('id')), 'count']],
      group: ['status', 'jobType'],
      raw: true,
    });

    return stats;
  }

  static async listJobs(params = {}) {
    const { status, jobType, supplierId, page = 1, pageSize = 20 } = params;
    const where = {};

    if (status) where.status = status;
    if (jobType) where.jobType = jobType;
    if (supplierId) where.supplierId = supplierId;

    return await CompensationQueue.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [{ association: 'lossRecord' }],
    });
  }
}

module.exports = QueueService;

const logger = require('../config/logger');
const QueueService = require('../services/queueService');
const { compensationQueue } = require('../config/queue');

class CompensationWorker {
  static async processJob(job) {
    const { queueId, queueNo, jobType, payload } = job.data;
    logger.info(`开始处理任务: ${queueNo}, 类型: ${jobType}`);

    try {
      await QueueService.processJob(queueId);

      let result;
      switch (jobType) {
        case 'loss_calculation':
          result = await this.handleLossCalculation(payload);
          break;
        case 'bad_fruit_deduction':
          result = await this.handleBadFruitDeduction(payload);
          break;
        case 'secondary_sorting':
          result = await this.handleSecondarySorting(payload);
          break;
        case 'duplicate_check':
          result = await this.handleDuplicateCheck(payload);
          break;
        case 'compensation':
          result = await this.handleCompensation(payload);
          break;
        case 'external_receipt':
          result = await this.handleExternalReceipt(payload);
          break;
        default:
          throw new Error(`不支持的任务类型: ${jobType}`);
      }

      await QueueService.markJobSuccess(queueId, result);
      return result;
    } catch (error) {
      logger.error(`任务处理失败 ${queueNo}:`, error);
      
      const isRetryable = this.isRetryableError(error);
      await QueueService.markJobFailed(queueId, error, isRetryable);
      
      throw error;
    }
  }

  static isRetryableError(error) {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION_ERROR',
      'SERVICE_UNAVAILABLE',
      'EXTERNAL_API_ERROR',
    ];
    
    const errorCode = error.code || error.name;
    return retryableErrors.some(code => 
      error.message.includes(code) || errorCode === code
    );
  }

  static async handleLossCalculation(payload) {
    logger.info('执行损耗计算:', payload);
    return { calculated: true, timestamp: new Date().toISOString() };
  }

  static async handleBadFruitDeduction(payload) {
    logger.info('执行坏果扣款:', payload);
    if (payload.simulateError) {
      const error = new Error('模拟外部系统异常: 扣款服务暂时不可用');
      error.code = 'EXTERNAL_API_ERROR';
      throw error;
    }
    return { deducted: true, amount: payload.amount || 0 };
  }

  static async handleSecondarySorting(payload) {
    logger.info('执行二次分拣损耗处理:', payload);
    return { processed: true };
  }

  static async handleDuplicateCheck(payload) {
    logger.info('执行重复检查:', payload);
    return { isDuplicate: false };
  }

  static async handleCompensation(payload) {
    logger.info('执行补偿入账:', payload);
    return { compensated: true, amount: payload.compensationAmount || 0 };
  }

  static async handleExternalReceipt(payload) {
    logger.info('处理外部回执:', payload);
    return { receiptProcessed: true };
  }

  static start() {
    logger.info('启动补偿队列处理器...');
    compensationQueue.process(this.processJob.bind(this));
  }
}

module.exports = CompensationWorker;

const cron = require('node-cron');
const db = require('../config/database');
const logger = require('../utils/logger');
const { ApprovalStatus, ApprovalAction, QuotaActionType } = require('../utils/constants');
const QuotaModel = require('../models/QuotaModel');
const ApprovalRecordModel = require('../models/ApprovalRecordModel');
const QuotaOperationModel = require('../models/QuotaOperationModel');
const AuditLogModel = require('../models/AuditLogModel');

const DEFAULT_CRON_EXPRESSION = '*/5 * * * * *';

class CronService {
  static cronJob = null;

  static startCronJobs() {
    const cronExpression = process.env.CRON_EXPRESSION || DEFAULT_CRON_EXPRESSION;
    
    if (!cron.validate(cronExpression)) {
      logger.error(`无效的 cron 表达式: ${cronExpression}，使用默认值: ${DEFAULT_CRON_EXPRESSION}`);
      cronExpression = DEFAULT_CRON_EXPRESSION;
    }

    logger.info(`启动定时任务，表达式: ${cronExpression}`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await this.processExpiredApprovals();
      } catch (error) {
        logger.error('处理过期审批时出错:', error);
      }
    });

    logger.info('定时任务已启动');
  }

  static stopCronJobs() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('定时任务已停止');
    }
  }

  static async processExpiredApprovals() {
    logger.debug('开始处理过期审批...');

    await db.transaction(async (client) => {
      const expiredRecords = await ApprovalRecordModel.expirePendingRecords(client);
      
      if (expiredRecords.length === 0) {
        logger.debug('没有需要处理的过期审批');
        return;
      }

      logger.info(`发现 ${expiredRecords.length} 个过期审批需要处理`);

      for (const record of expiredRecords) {
        try {
          await this.processSingleExpiredApproval(record, client);
        } catch (error) {
          logger.error(`处理过期审批失败，requestId=${record.request_id}:`, error);
        }
      }

      logger.info(`成功处理 ${expiredRecords.length} 个过期审批`);
    });
  }

  static async processSingleExpiredApproval(record, client) {
    const applyAmount = parseFloat(record.apply_amount);

    const existingRelease = await QuotaOperationModel.findByRequestId(
      record.request_id,
      QuotaActionType.RELEASE,
      client
    );

    if (existingRelease.length > 0) {
      logger.debug(`审批 ${record.request_id} 已经释放过，跳过`);
      return;
    }

    const quota = await QuotaModel.findById(record.quota_id, client);
    if (!quota) {
      logger.error(`找不到关联的限额，quotaId=${record.quota_id}`);
      return;
    }

    const updatedQuota = await QuotaModel.releaseOccupiedAmount(quota.id, applyAmount, client);
    if (!updatedQuota) {
      logger.warn(`限额更新并发冲突，requestId=${record.request_id}，稍后重试`);
      return;
    }

    await QuotaOperationModel.create({
      quotaId: quota.id,
      quotaCode: quota.quota_code,
      approvalRecordId: record.id,
      requestId: record.request_id,
      operationType: QuotaActionType.RELEASE,
      amount: applyAmount,
      operator: 'SYSTEM',
      description: `审批过期自动释放限额，金额: ${applyAmount}`,
    }, client);

    await AuditLogModel.create({
      auditType: 'APPROVAL_OPERATION',
      entityType: 'APPROVAL',
      entityId: record.request_id,
      action: ApprovalAction.EXPIRE,
      beforeData: { status: ApprovalStatus.PENDING },
      afterData: { status: ApprovalStatus.EXPIRED },
      operator: 'SYSTEM',
      ipAddress: null,
      userAgent: null,
    }, client);

    logger.info(`过期审批已释放，requestId=${record.request_id}, amount=${applyAmount}`);
  }
}

module.exports = {
  startCronJobs: () => CronService.startCronJobs(),
  stopCronJobs: () => CronService.stopCronJobs(),
  processExpiredApprovals: () => CronService.processExpiredApprovals(),
};

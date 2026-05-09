const RecoveryRecord = require('../models/RecoveryRecord');
const LineStop = require('../models/LineStop');
const { STATUS, RECOVERY_STATUS } = require('../utils/constants');
const { NotFoundError, BusinessRuleError, ConflictError } = require('../utils/errors');
const LineStopService = require('./LineStopService');
const StatusMachineService = require('./StatusMachineService');
const logger = require('../utils/logger');

class RecoveryService {
  static async startRecovery(lineStopId, data) {
    const lineStop = await LineStopService.getLineStopById(lineStopId, false);
    
    StatusMachineService.checkLineStopStatus(
      lineStop,
      [STATUS.RESPONSIBILITY_ASSIGNED],
      '开始复产'
    );

    const activeRecovery = await RecoveryRecord.findOne({
      where: {
        lineStopId,
        status: [RECOVERY_STATUS.STARTED, RECOVERY_STATUS.IN_PROGRESS, RECOVERY_STATUS.VERIFYING]
      }
    });

    if (activeRecovery) {
      throw new ConflictError(
        '已有进行中的复产记录',
        { activeRecoveryId: activeRecovery.id }
      );
    }

    const record = await RecoveryRecord.create({
      lineStopId,
      startTime: data.startTime || new Date(),
      operator: data.operator,
      actions: data.actions,
      verificationItems: data.verificationItems ? 
        JSON.stringify(data.verificationItems) : null,
      status: RECOVERY_STATUS.STARTED
    });

    await LineStopService.updateStatus(
      lineStopId,
      STATUS.RECOVERY_IN_PROGRESS,
      data.operator,
      '复产开始'
    );

    logger.info('复产开始', {
      lineStopId,
      recoveryId: record.id,
      operator: data.operator
    });

    return record;
  }

  static async updateRecovery(recoveryId, data) {
    const record = await RecoveryRecord.findOne({ where: { id: recoveryId } });
    
    if (!record) {
      throw new NotFoundError(`复产记录不存在: ${recoveryId}`);
    }

    if ([RECOVERY_STATUS.COMPLETED, RECOVERY_STATUS.FAILED].includes(record.status)) {
      throw new BusinessRuleError(
        '已完成或失败的复产记录不能修改',
        { currentStatus: record.status }
      );
    }

    const updateData = {};
    if (data.actions) updateData.actions = data.actions;
    if (data.verificationItems) {
      updateData.verificationItems = JSON.stringify(data.verificationItems);
    }
    if (data.status) {
      if (![RECOVERY_STATUS.IN_PROGRESS, RECOVERY_STATUS.VERIFYING].includes(data.status)) {
        throw new BusinessRuleError(
          '复产过程中只能流转到 IN_PROGRESS 或 VERIFYING',
          { requestedStatus: data.status }
        );
      }
      updateData.status = data.status;
    }

    await record.update(updateData);

    logger.info('复产记录已更新', {
      recoveryId,
      updates: Object.keys(updateData)
    });

    return record;
  }

  static async completeRecovery(recoveryId, data) {
    const record = await RecoveryRecord.findOne({ where: { id: recoveryId } });
    
    if (!record) {
      throw new NotFoundError(`复产记录不存在: ${recoveryId}`);
    }

    if (record.status === RECOVERY_STATUS.COMPLETED) {
      return {
        record,
        message: '复产已完成，无需重复操作'
      };
    }

    if (record.status === RECOVERY_STATUS.FAILED) {
      throw new BusinessRuleError('已失败的复产记录不能标记为完成');
    }

    const endTime = data.endTime || new Date();
    await record.update({
      status: RECOVERY_STATUS.COMPLETED,
      endTime,
      remarks: data.remarks
    });

    const lineStop = await LineStopService.getLineStopById(record.lineStopId, false);
    
    if (record.startTime && endTime) {
      const actualDuration = Math.round(
        (new Date(endTime) - new Date(record.startTime)) / 60000
      );
      await lineStop.update({ actualDuration });
    }

    await LineStopService.updateStatus(
      record.lineStopId,
      STATUS.RECOVERED,
      data.operator,
      '复产完成，进入复盘阶段'
    );

    logger.info('复产完成', {
      recoveryId,
      lineStopId: record.lineStopId,
      operator: data.operator
    });

    return {
      record,
      message: '复产完成'
    };
  }

  static async failRecovery(recoveryId, data) {
    const record = await RecoveryRecord.findOne({ where: { id: recoveryId } });
    
    if (!record) {
      throw new NotFoundError(`复产记录不存在: ${recoveryId}`);
    }

    if ([RECOVERY_STATUS.COMPLETED, RECOVERY_STATUS.FAILED].includes(record.status)) {
      throw new BusinessRuleError(
        '复产已结束，不能重复标记失败',
        { currentStatus: record.status }
      );
    }

    await record.update({
      status: RECOVERY_STATUS.FAILED,
      failureReason: data.failureReason,
      endTime: data.endTime || new Date()
    });

    logger.warn('复产失败', {
      recoveryId,
      lineStopId: record.lineStopId,
      failureReason: data.failureReason
    });

    return {
      record,
      message: '复产已标记为失败，可以重新开始复产',
      suggestion: '修复问题后调用 startRecovery 重新开始复产流程'
    };
  }

  static async getRecoveryByLineStop(lineStopId) {
    return await RecoveryRecord.findAll({
      where: { lineStopId },
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = RecoveryService;

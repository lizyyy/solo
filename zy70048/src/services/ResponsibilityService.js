const Responsibility = require('../models/Responsibility');
const { STATUS, RESPONSIBILITY_STATUS } = require('../utils/constants');
const { NotFoundError, BusinessRuleError, ConflictError } = require('../utils/errors');
const LineStopService = require('./LineStopService');
const StatusMachineService = require('./StatusMachineService');
const logger = require('../utils/logger');

class ResponsibilityService {
  static async assignResponsibility(lineStopId, data) {
    const lineStop = await LineStopService.getLineStopById(lineStopId, false);
    
    StatusMachineService.checkLineStopStatus(
      lineStop,
      [STATUS.REASON_CONFIRMED],
      '分配责任'
    );

    const existingConfirmed = await Responsibility.findOne({
      where: {
        lineStopId,
        status: RESPONSIBILITY_STATUS.CONFIRMED
      }
    });

    if (existingConfirmed) {
      throw new ConflictError(
        '已有已确认的责任记录，如需修改请先申诉',
        { 
          existingId: existingConfirmed.id,
          existingStatus: existingConfirmed.status,
          suggestion: '如果需要重新分配责任，请先对现有责任进行申诉'
        }
      );
    }

    const existingAppealed = await Responsibility.findOne({
      where: {
        lineStopId,
        status: RESPONSIBILITY_STATUS.APPEALED
      }
    });

    if (existingAppealed) {
      logger.info('存在已申诉的责任记录，将创建新的责任记录替代', {
        lineStopId,
        appealedId: existingAppealed.id
      });
    }

    const responsibility = await Responsibility.create({
      lineStopId,
      responsibleDepartment: data.responsibleDepartment,
      responsiblePerson: data.responsiblePerson,
      reason: data.reason,
      severity: data.severity || 'MEDIUM',
      correctiveAction: data.correctiveAction,
      preventiveAction: data.preventiveAction,
      confirmedBy: data.confirmedBy,
      confirmedAt: data.confirmedAt || new Date(),
      status: RESPONSIBILITY_STATUS.CONFIRMED
    });

    await LineStopService.updateStatus(
      lineStopId,
      STATUS.RESPONSIBILITY_ASSIGNED,
      data.confirmedBy,
      '责任已分配，可开始复产'
    );

    logger.info('责任分配成功', {
      lineStopId,
      responsibilityId: responsibility.id,
      responsiblePerson: data.responsiblePerson
    });

    return responsibility;
  }

  static async getResponsibilityByLineStop(lineStopId) {
    return await Responsibility.findAll({
      where: { lineStopId },
      order: [['createdAt', 'DESC']]
    });
  }

  static async appealResponsibility(responsibilityId, operator, appealReason) {
    const responsibility = await Responsibility.findOne({ 
      where: { id: responsibilityId } 
    });
    
    if (!responsibility) {
      throw new NotFoundError(`责任记录不存在: ${responsibilityId}`);
    }

    if (responsibility.status === RESPONSIBILITY_STATUS.APPEALED) {
      throw new ConflictError('该责任已在申诉中');
    }

    if (responsibility.status === RESPONSIBILITY_STATUS.FINALIZED) {
      throw new BusinessRuleError('已终审的责任不能再申诉');
    }

    await responsibility.update({
      status: RESPONSIBILITY_STATUS.APPEALED,
      appealReason
    });

    const lineStop = await LineStopService.getLineStopById(
      responsibility.lineStopId, 
      false
    );

    if (lineStop.status === STATUS.RESPONSIBILITY_ASSIGNED) {
      await LineStopService.updateStatus(
        responsibility.lineStopId,
        STATUS.REASON_CONFIRMED,
        operator,
        `责任申诉: ${appealReason}`
      );
    }

    logger.info('责任申诉已提交', {
      responsibilityId,
      operator,
      appealReason
    });

    return {
      responsibility,
      message: '申诉已提交，等待重新确认'
    };
  }

  static async finalizeResponsibility(responsibilityId, operator) {
    const responsibility = await Responsibility.findOne({ 
      where: { id: responsibilityId } 
    });
    
    if (!responsibility) {
      throw new NotFoundError(`责任记录不存在: ${responsibilityId}`);
    }

    if (responsibility.status === RESPONSIBILITY_STATUS.FINALIZED) {
      return {
        responsibility,
        message: '责任已终审'
      };
    }

    await responsibility.update({
      status: RESPONSIBILITY_STATUS.FINALIZED
    });

    logger.info('责任已终审', {
      responsibilityId,
      operator
    });

    return {
      responsibility,
      message: '责任终审完成'
    };
  }
}

module.exports = ResponsibilityService;

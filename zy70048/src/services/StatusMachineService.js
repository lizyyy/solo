const { STATUS, STATUS_TRANSITIONS, STATUS_DESCRIPTIONS } = require('../utils/constants');
const { StateTransitionError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class StatusMachineService {
  static validateTransition(fromStatus, toStatus) {
    const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
    
    if (!allowedTransitions) {
      throw new StateTransitionError(
        `无效的起始状态: ${fromStatus}`,
        { fromStatus, toStatus }
      );
    }
    
    if (!allowedTransitions.includes(toStatus)) {
      const allowedList = allowedTransitions.length > 0 
        ? allowedTransitions.map(s => `${s}(${STATUS_DESCRIPTIONS[s]})`).join('、')
        : '无(当前为终态)';
      
      throw new StateTransitionError(
        `状态流转无效: 不能从「${STATUS_DESCRIPTIONS[fromStatus]}(${fromStatus})」流转到「${STATUS_DESCRIPTIONS[toStatus] || toStatus}(${toStatus})」`,
        {
          fromStatus,
          fromDescription: STATUS_DESCRIPTIONS[fromStatus],
          toStatus,
          toDescription: STATUS_DESCRIPTIONS[toStatus],
          allowedTransitions: allowedList
        }
      );
    }
    
    return true;
  }

  static isTerminalStatus(status) {
    return STATUS_TRANSITIONS[status]?.length === 0;
  }

  static getAllowedTransitions(status) {
    return STATUS_TRANSITIONS[status] || [];
  }

  static getStatusDescription(status) {
    return STATUS_DESCRIPTIONS[status] || status;
  }

  static canSubmitReason(status) {
    return [STATUS.CREATED, STATUS.REASON_ANALYZING].includes(status);
  }

  static canConfirmReason(status) {
    return status === STATUS.REASON_ANALYZING;
  }

  static canAssignResponsibility(status) {
    return status === STATUS.REASON_CONFIRMED;
  }

  static canStartRecovery(status) {
    return status === STATUS.RESPONSIBILITY_ASSIGNED;
  }

  static canCompleteRecovery(status) {
    return status === STATUS.RECOVERY_IN_PROGRESS;
  }

  static canStartReview(status) {
    return status === STATUS.RECOVERED;
  }

  static canCompleteReview(status) {
    return status === STATUS.REVIEWING;
  }

  static checkLineStopStatus(lineStop, requiredStatuses, actionName) {
    if (!lineStop) {
      throw new NotFoundError('停线事件不存在');
    }
    
    if (!requiredStatuses.includes(lineStop.status)) {
      const allowedList = requiredStatuses.map(s => 
        `${s}(${STATUS_DESCRIPTIONS[s]})`
      ).join('、');
      
      throw new StateTransitionError(
        `无法执行「${actionName}」: 当前状态「${STATUS_DESCRIPTIONS[lineStop.status]}(${lineStop.status})」不允许此操作`,
        {
          currentStatus: lineStop.status,
          currentDescription: STATUS_DESCRIPTIONS[lineStop.status],
          allowedStatuses: allowedList,
          action: actionName
        }
      );
    }
    
    return true;
  }

  static logTransition(lineStopId, fromStatus, toStatus, operator, reason, metadata) {
    logger.info(`状态流转: 事件 ${lineStopId}`, {
      lineStopId,
      fromStatus,
      toStatus,
      operator,
      reason,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = StatusMachineService;

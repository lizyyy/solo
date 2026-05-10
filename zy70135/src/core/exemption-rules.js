const { EXEMPTION_STATUS, EXEMPTION_TYPE } = require('./constants');
const DateUtils = require('../utils/date-utils');
const { BusinessRuleError, ConflictError, BadRequestError } = require('../utils/errors');
const config = require('../config');

class ExemptionRules {
  static validateDuration(durationDays, type = EXEMPTION_TYPE.TEMPORARY) {
    if (type === EXEMPTION_TYPE.PERMANENT) {
      return true;
    }

    const maxDuration = config.exemption.maxDurationDays || 90;
    const minDuration = 1;

    if (durationDays < minDuration) {
      throw new BusinessRuleError('豁免时长不能少于1天');
    }

    if (durationDays > maxDuration) {
      throw new BusinessRuleError(`豁免时长不能超过 ${maxDuration} 天`);
    }

    return true;
  }

  static canRequestExemption(
    currentStatus,
    hasActiveExemption,
    isManuallyCorrected = false
  ) {
    if (isManuallyCorrected) {
      throw new BusinessRuleError('已人工修正的记录不允许申请豁免');
    }

    if (hasActiveExemption) {
      throw new ConflictError('该会员已存在有效豁免');
    }

    return true;
  }

  static canApprove(currentStatus, requesterRole, approverRole) {
    if (currentStatus !== EXEMPTION_STATUS.PENDING) {
      throw new ConflictError(
        `只有待审批的豁免可以被处理，当前状态: ${currentStatus}`
      );
    }

    if (requesterRole === approverRole && requesterRole !== 'admin') {
      throw new BusinessRuleError('审批人和申请人不能是同一个角色（非管理员）');
    }

    return true;
  }

  static canReject(currentStatus) {
    if (currentStatus !== EXEMPTION_STATUS.PENDING) {
      throw new ConflictError(
        `只有待审批的豁免可以被拒绝，当前状态: ${currentStatus}`
      );
    }
    return true;
  }

  static canRevoke(currentStatus, isAdmin) {
    const allowedStatuses = [EXEMPTION_STATUS.APPROVED, EXEMPTION_STATUS.PENDING];

    if (!allowedStatuses.includes(currentStatus)) {
      throw new ConflictError(
        `当前状态 ${currentStatus} 不允许撤销`
      );
    }

    if (!isAdmin) {
      throw new BusinessRuleError('只有管理员可以撤销豁免');
    }

    return true;
  }

  static calculateExpiryDate(startDate, durationDays) {
    return DateUtils.addDays(startDate || new Date(), durationDays);
  }

  static isExpired(expiryDate, currentDate = new Date()) {
    return DateUtils.isBefore(expiryDate, currentDate);
  }

  static isActive(exemption, currentDate = new Date()) {
    if (exemption.status !== EXEMPTION_STATUS.APPROVED) {
      return false;
    }

    if (exemption.type === EXEMPTION_TYPE.PERMANENT) {
      return true;
    }

    return !this.isExpired(exemption.expiryDate, currentDate);
  }

  static needsReview(exemption, currentDate = new Date()) {
    if (exemption.type === EXEMPTION_TYPE.PERMANENT) {
      return false;
    }

    const reviewDays = config.exemption.minReviewDays || 7;
    const reviewDate = DateUtils.addDays(exemption.approvedAt, reviewDays);

    return DateUtils.isAfter(currentDate, reviewDate);
  }

  static validateExemptionReason(reason) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestError('豁免原因不能为空');
    }

    if (reason.length < 10) {
      throw new BusinessRuleError('豁免原因描述不充分，请补充详细信息');
    }

    if (reason.length > 1000) {
      throw new BusinessRuleError('豁免原因不能超过1000个字符');
    }

    return true;
  }
}

module.exports = ExemptionRules;

const { BLACKLIST_STATUS, EXEMPTION_STATUS, config } = require('./constants');
const DateUtils = require('../utils/date-utils');
const { BusinessRuleError, ConflictError } = require('../utils/errors');

class BlacklistRules {
  static validateReasonLength(reason, maxLength = 500) {
    if (reason && reason.length > maxLength) {
      throw new BusinessRuleError(
        `黑名单原因不能超过 ${maxLength} 个字符`
      );
    }
    return true;
  }

  static canBeRemoved(currentStatus, hasActiveExemption = false) {
    if (hasActiveExemption) {
      throw new ConflictError('该会员存在有效豁免，不能直接移除');
    }
    return true;
  }

  static canBeManuallyCorrected(currentStatus, operatorRole) {
    if (currentStatus === BLACKLIST_STATUS.ACTIVE) {
      return true;
    }
    if (currentStatus === BLACKLIST_STATUS.EXEMPTED) {
      return true;
    }
    if (currentStatus === BLACKLIST_STATUS.INACTIVE) {
      return true;
    }
    throw new BusinessRuleError(`当前状态 ${currentStatus} 不允许人工修正`);
  }

  static determineEffectiveStatus(
    blacklistStatus,
    hasActiveExemption,
    exemptionStatus
  ) {
    if (blacklistStatus === BLACKLIST_STATUS.MANUALLY_CORRECTED) {
      return BLACKLIST_STATUS.MANUALLY_CORRECTED;
    }

    if (hasActiveExemption && exemptionStatus === EXEMPTION_STATUS.APPROVED) {
      return BLACKLIST_STATUS.EXEMPTED;
    }

    return blacklistStatus;
  }

  static isHit(
    memberIdentifier,
    blacklistStatus,
    hasActiveExemption,
    isManuallyCorrected = false
  ) {
    if (!memberIdentifier) {
      return false;
    }

    if (isManuallyCorrected) {
      return false;
    }

    if (hasActiveExemption) {
      return false;
    }

    return blacklistStatus === BLACKLIST_STATUS.ACTIVE;
  }

  static validateSyncStatus(currentVersion, targetVersion) {
    if (currentVersion === targetVersion) {
      return { isSync: true, needsSync: false };
    }

    return {
      isSync: false,
      needsSync: true,
      currentVersion,
      targetVersion,
    };
  }

  static calculateStatusChangeReason(oldStatus, newStatus, operator) {
    const reasons = [];

    if (oldStatus !== newStatus) {
      reasons.push(`状态变更: ${oldStatus} → ${newStatus}`);
    }

    reasons.push(`操作人: ${operator}`);
    reasons.push(`时间: ${DateUtils.format(new Date())}`);

    return reasons.join('; ');
  }
}

module.exports = BlacklistRules;

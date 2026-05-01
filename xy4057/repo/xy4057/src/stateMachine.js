const STATUS = {
  PENDING_CLEANING: 'PENDING_CLEANING',
  PENDING_ASSEMBLY: 'PENDING_ASSEMBLY',
  IN_STERILIZATION: 'IN_STERILIZATION',
  PENDING_QC: 'PENDING_QC',
  RELEASED: 'RELEASED',
  USED: 'USED',
  RECALLED: 'RECALLED'
};

const STATUS_LABELS = {
  [STATUS.PENDING_CLEANING]: '待清洗',
  [STATUS.PENDING_ASSEMBLY]: '待装配',
  [STATUS.IN_STERILIZATION]: '灭菌中',
  [STATUS.PENDING_QC]: '待质检',
  [STATUS.RELEASED]: '已放行',
  [STATUS.USED]: '已领用',
  [STATUS.RECALLED]: '已召回'
};

const ALLOWED_TRANSITIONS = {
  [STATUS.PENDING_CLEANING]: [STATUS.PENDING_ASSEMBLY],
  [STATUS.PENDING_ASSEMBLY]: [STATUS.IN_STERILIZATION],
  [STATUS.IN_STERILIZATION]: [STATUS.PENDING_QC],
  [STATUS.PENDING_QC]: [STATUS.RELEASED, STATUS.PENDING_CLEANING],
  [STATUS.RELEASED]: [STATUS.USED, STATUS.RECALLED],
  [STATUS.USED]: [STATUS.PENDING_CLEANING],
  [STATUS.RECALLED]: [STATUS.PENDING_CLEANING]
};

function isValidStatus(status) {
  return Object.values(STATUS).includes(status);
}

function canTransition(fromStatus, toStatus) {
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) {
    return false;
  }
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function getNextAllowedStatuses(currentStatus) {
  if (!isValidStatus(currentStatus)) {
    return [];
  }
  return ALLOWED_TRANSITIONS[currentStatus] || [];
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function getTransitionDescription(fromStatus, toStatus) {
  const fromLabel = getStatusLabel(fromStatus);
  const toLabel = getStatusLabel(toStatus);
  
  if (toStatus === STATUS.PENDING_CLEANING) {
    if (fromStatus === STATUS.RECALLED) {
      return `${fromLabel} -> ${toLabel}（召回后重新处理）`;
    }
    if (fromStatus === STATUS.USED) {
      return `${fromLabel} -> ${toLabel}（使用后回收）`;
    }
    if (fromStatus === STATUS.PENDING_QC) {
      return `${fromLabel} -> ${toLabel}（质检不合格退回）`;
    }
  }
  
  return `${fromLabel} -> ${toLabel}`;
}

function validateTransition(packageData, toStatus, additionalContext = {}) {
  const errors = [];
  
  if (!isValidStatus(toStatus)) {
    errors.push({
      code: 'INVALID_STATUS',
      message: `无效的目标状态: ${toStatus}`
    });
    return { valid: false, errors };
  }

  if (!canTransition(packageData.current_status, toStatus)) {
    errors.push({
      code: 'INVALID_TRANSITION',
      message: `状态流转不允许: ${getStatusLabel(packageData.current_status)} 不能直接流转到 ${getStatusLabel(toStatus)}`
    });
    return { valid: false, errors };
  }

  if (toStatus === STATUS.IN_STERILIZATION) {
    if (!additionalContext.cycleId) {
      errors.push({
        code: 'MISSING_CYCLE_ID',
        message: '开始灭菌时必须关联锅次ID'
      });
    }
  }

  if (toStatus === STATUS.PENDING_QC) {
    if (!additionalContext.cycleCompleted) {
      errors.push({
        code: 'CYCLE_NOT_COMPLETED',
        message: '锅次未完成，无法进入待质检状态'
      });
    }
  }

  if (toStatus === STATUS.RELEASED) {
    if (!additionalContext.qcPassed) {
      errors.push({
        code: 'QC_NOT_PASSED',
        message: '质检未通过，无法放行'
      });
    }
    if (!additionalContext.expirationDate) {
      errors.push({
        code: 'MISSING_EXPIRATION',
        message: '放行时必须设置有效期'
      });
    }
  }

  if (toStatus === STATUS.USED) {
    if (!additionalContext.department) {
      errors.push({
        code: 'MISSING_DEPARTMENT',
        message: '领用时必须指定科室'
      });
    }
  }

  if (toStatus === STATUS.RECALLED) {
    if (!additionalContext.reason) {
      errors.push({
        code: 'MISSING_RECALL_REASON',
        message: '召回时必须提供原因'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  STATUS,
  STATUS_LABELS,
  isValidStatus,
  canTransition,
  getNextAllowedStatuses,
  getStatusLabel,
  getTransitionDescription,
  validateTransition
};

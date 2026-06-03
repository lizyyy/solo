const { STATUS, CHANGE_TYPE, FIELDS, ALLOWED_TRANSITIONS } = require('./constants');

function parseDateStr(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace(/[^\d]/g, '');
  if (clean.length === 8) {
    return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(date1, date2) {
  const d1 = parseDateStr(date1);
  const d2 = parseDateStr(date2);
  if (!d1 || !d2) return null;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function detectT1ToT2ManualChange(oldValue, newValue) {
  const days = daysBetween(oldValue, newValue);
  return days === 1;
}

function classifyChange(fieldName, oldValue, newValue) {
  if (fieldName === FIELDS.SETTLEMENT_DATE) {
    if (detectT1ToT2ManualChange(oldValue, newValue)) {
      return CHANGE_TYPE.T1_TO_T2_MANUAL;
    }
  }
  if (fieldName === FIELDS.QUANTITY) {
    return CHANGE_TYPE.QUANTITY_ADJUSTMENT;
  }
  if (fieldName === FIELDS.AMOUNT) {
    return CHANGE_TYPE.AMOUNT_ADJUSTMENT;
  }
  return CHANGE_TYPE.OTHER;
}

function requiresManagerReview(changeType) {
  return changeType === CHANGE_TYPE.T1_TO_T2_MANUAL;
}

function validateTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function determineNextStatusAfterChange(currentStatus, changeType) {
  if (requiresManagerReview(changeType)) {
    if (currentStatus === STATUS.SCREENSHOT_REVIEWED || currentStatus === STATUS.IMPORTED) {
      return STATUS.PENDING_MANAGER_REVIEW;
    }
  }
  return currentStatus;
}

function determineNextStatusAfterScreenshotReview(record) {
  if (record.has_manual_change && record.change_type === CHANGE_TYPE.T1_TO_T2_MANUAL) {
    return STATUS.PENDING_MANAGER_REVIEW;
  }
  return STATUS.SCREENSHOT_REVIEWED;
}

function canRevert(status) {
  return status !== STATUS.REVERTED;
}

function getRevertTargetStatus(status) {
  const revertMap = {
    [STATUS.SCREENSHOT_REVIEWED]: STATUS.IMPORTED,
    [STATUS.PENDING_MANAGER_REVIEW]: STATUS.SCREENSHOT_REVIEWED,
    [STATUS.MANAGER_APPROVED]: STATUS.PENDING_MANAGER_REVIEW,
    [STATUS.MANAGER_REJECTED]: STATUS.PENDING_MANAGER_REVIEW,
    [STATUS.NORMAL]: STATUS.MANAGER_APPROVED,
    [STATUS.REVERTED]: STATUS.IMPORTED
  };
  return revertMap[status] || STATUS.IMPORTED;
}

function canFinalize(status, record) {
  if (record.has_manual_change && record.change_type === CHANGE_TYPE.T1_TO_T2_MANUAL) {
    return status === STATUS.MANAGER_APPROVED;
  }
  return status === STATUS.SCREENSHOT_REVIEWED;
}

function validateChange(fieldName, oldValue, newValue, operator) {
  const errors = [];
  if (!fieldName) {
    errors.push('字段名不能为空');
  }
  if (oldValue === undefined || oldValue === null) {
    errors.push('原值不能为空');
  }
  if (newValue === undefined || newValue === null) {
    errors.push('新值不能为空');
  }
  if (!operator) {
    errors.push('操作员不能为空');
  }
  if (fieldName === FIELDS.SETTLEMENT_DATE) {
    if (!parseDateStr(newValue)) {
      errors.push('新的到账日格式不正确');
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

const BOUNDARY_RULES = {
  T1_TO_T2_MANUAL: {
    description: 'T+1到账被手工改成T+2',
    detection: '原始到账日与当前到账日相差1天',
    requiredReview: true,
    reviewerRole: '基金经理',
    autoFinalize: false,
    revertAllowed: true,
    revertTo: 'PENDING_MANAGER_REVIEW'
  },
  STATUS_TRANSITION: {
    IMPORTED_TO_SCREENSHOT_REVIEWED: '托管确认页导入完成后，运营补看除权日截图',
    SCREENSHOT_REVIEWED_TO_PENDING: '发现T+1→T+2手工改动，提交基金经理复核',
    PENDING_TO_APPROVED: '基金经理复核通过',
    PENDING_TO_REJECTED: '基金经理复核驳回，需重新核对',
    APPROVED_TO_NORMAL: '基金经理通过后，可标记为正常',
    SCREENSHOT_REVIEWED_TO_NORMAL: '无异常改动，直接标记为正常',
    ANY_TO_REVERTED: '任何状态均可回滚至上一状态'
  }
};

module.exports = {
  parseDateStr,
  daysBetween,
  detectT1ToT2ManualChange,
  classifyChange,
  requiresManagerReview,
  validateTransition,
  determineNextStatusAfterChange,
  determineNextStatusAfterScreenshotReview,
  canRevert,
  getRevertTargetStatus,
  canFinalize,
  validateChange,
  BOUNDARY_RULES
};

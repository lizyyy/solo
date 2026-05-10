const { DEFAULT_CUTOFF_TIME } = require('../utils/constants');
const helpers = require('../utils/helpers');

function validateRequiredFields(data) {
  const errors = [];
  const warnings = [];
  
  const requiredKeys = ['reservation', 'actual', 'cost'];
  const optionalKeys = ['cancel', 'extra', 'leftover'];
  
  requiredKeys.forEach(key => {
    if (!data[key] || !Array.isArray(data[key]) || data[key].length === 0) {
      errors.push(`缺少必填数据: ${key}`);
    }
  });
  
  return { errors, warnings };
}

function validateLateCancels(cancelList, defaultCutoff = DEFAULT_CUTOFF_TIME) {
  const errors = [];
  const warnings = [];
  
  if (!cancelList || !Array.isArray(cancelList)) {
    return { errors, warnings };
  }
  
  cancelList.forEach((cancel, index) => {
    const cutoff = cancel.cutOffTime || defaultCutoff;
    const cancelTime = cancel.cancelTime;
    
    if (!cancelTime) {
      errors.push(`退餐记录 #${index + 1} 缺少退餐时间`);
      return;
    }
    
    if (!helpers.isTimeBefore(cancelTime, cutoff)) {
      warnings.push({
        type: 'late_cancel',
        message: `退餐晚于备餐截止时间: 部门=${cancel.department}, 退餐时间=${cancelTime}, 截止时间=${cutoff}`,
        details: cancel
      });
    }
  });
  
  return { errors, warnings };
}

function validateActualVsReservation(reservationList, actualList, extraList = []) {
  const errors = [];
  const warnings = [];
  
  const reservationByKey = {};
  reservationList.forEach(res => {
    const key = `${res.date}_${res.department}_${res.mealType}`;
    reservationByKey[key] = (reservationByKey[key] || 0) + res.headcount;
  });
  
  const extraByKey = {};
  extraList.forEach(extra => {
    const key = `${extra.date}_${extra.department}_${extra.mealType}`;
    extraByKey[key] = (extraByKey[key] || 0) + extra.extraCount;
  });
  
  const actualByKey = {};
  actualList.forEach(actual => {
    const key = `${actual.date}_${actual.department}_${actual.mealType}`;
    actualByKey[key] = (actualByKey[key] || 0) + actual.actualCount;
  });
  
  Object.keys(actualByKey).forEach(key => {
    const actualCount = actualByKey[key];
    const reservationCount = reservationByKey[key] || 0;
    const extraCount = extraByKey[key] || 0;
    const maxAllowed = reservationCount + extraCount;
    
    if (actualCount > maxAllowed) {
      warnings.push({
        type: 'actual_exceeds_reservation',
        message: `实际取餐大于预约(含加餐): ${key}, 实际=${actualCount}, 预约+加餐=${maxAllowed}`,
        details: { actualCount, reservationCount, extraCount, maxAllowed }
      });
    }
  });
  
  return { errors, warnings };
}

function validateLeftoverWeights(leftoverList) {
  const errors = [];
  const warnings = [];
  
  if (!leftoverList || !Array.isArray(leftoverList) || leftoverList.length === 0) {
    warnings.push({
      type: 'leftover_missing',
      message: '缺少剩菜重量数据',
      details: null
    });
    return { errors, warnings };
  }
  
  leftoverList.forEach((leftover, index) => {
    if (leftover.weight === undefined || leftover.weight === null || isNaN(leftover.weight)) {
      errors.push(`剩菜记录 #${index + 1} 缺少重量数据: ${leftover.dish || '未知菜品'}`);
    }
  });
  
  return { errors, warnings };
}

function validateAll(data, defaultCutoff = DEFAULT_CUTOFF_TIME) {
  const allErrors = [];
  const allWarnings = [];
  
  const required = validateRequiredFields(data);
  allErrors.push(...required.errors);
  allWarnings.push(...required.warnings);
  
  if (data.cancel) {
    const cancel = validateLateCancels(data.cancel, defaultCutoff);
    allErrors.push(...cancel.errors);
    allWarnings.push(...cancel.warnings);
  }
  
  const actualVsRes = validateActualVsReservation(
    data.reservation || [],
    data.actual || [],
    data.extra || []
  );
  allErrors.push(...actualVsRes.errors);
  allWarnings.push(...actualVsRes.warnings);
  
  const leftover = validateLeftoverWeights(data.leftover);
  allErrors.push(...leftover.errors);
  allWarnings.push(...leftover.warnings);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    hasWarnings: allWarnings.length > 0
  };
}

module.exports = {
  validateRequiredFields,
  validateLateCancels,
  validateActualVsReservation,
  validateLeftoverWeights,
  validateAll
};

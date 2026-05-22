const SUBSIDY_RATE = 0.05;
const MIN_BOX_OFFICE_FOR_SUBSIDY = 1000;
const MAX_REFUND_RATIO = 0.3;

function validateScreeningData(screening) {
  const requiredFields = [
    'screeningId', 'cinemaId', 'cinemaName', 'filmId', 'filmName',
    'startTime', 'endTime', 'totalBoxOffice', 'refundAmount', 'audienceCount'
  ];
  
  const missingFields = requiredFields.filter(field => screening[field] === undefined || screening[field] === null || screening[field] === '');
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      category: 'pending',
      reason: `缺少必填字段: ${missingFields.join(', ')}`
    };
  }
  
  if (screening.totalBoxOffice < 0) {
    return {
      valid: false,
      category: 'blocked',
      reason: '票房金额不能为负数'
    };
  }
  
  if (screening.refundAmount < 0) {
    return {
      valid: false,
      category: 'blocked',
      reason: '退票金额不能为负数'
    };
  }
  
  if (screening.refundAmount > screening.totalBoxOffice) {
    return {
      valid: false,
      category: 'blocked',
      reason: '退票金额不能大于总票房'
    };
  }
  
  return { valid: true };
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateCrossDaySplit(startTime, endTime, totalBoxOffice) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const startDate = getLocalDateString(start);
  const endDate = getLocalDateString(end);
  
  if (startDate === endDate) {
    return [{ date: startDate, amount: totalBoxOffice }];
  }
  
  const midnight = new Date(start);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  
  const totalDuration = end - start;
  const day1Duration = midnight - start;
  const day2Duration = end - midnight;
  
  const day1Ratio = day1Duration / totalDuration;
  const day2Ratio = day2Duration / totalDuration;
  
  return [
    { date: startDate, amount: Number((totalBoxOffice * day1Ratio).toFixed(2)) },
    { date: endDate, amount: Number((totalBoxOffice * day2Ratio).toFixed(2)) }
  ];
}

function processRefund(screening) {
  const netBoxOffice = screening.totalBoxOffice - screening.refundAmount;
  const refundRatio = screening.totalBoxOffice > 0 ? screening.refundAmount / screening.totalBoxOffice : 0;
  
  return {
    netBoxOffice,
    refundDeduction: screening.refundAmount,
    refundRatio,
    isHighRefund: refundRatio > MAX_REFUND_RATIO
  };
}

function applyGuarantee(screening, netBoxOffice) {
  if (!screening.hasMinimumGuarantee) {
    return {
      finalBoxOffice: netBoxOffice,
      guaranteeApplied: false,
      guaranteeAmount: null
    };
  }
  
  const guaranteeAmount = screening.guaranteeAmount || 0;
  
  if (netBoxOffice < guaranteeAmount) {
    return {
      finalBoxOffice: guaranteeAmount,
      guaranteeApplied: true,
      guaranteeAmount
    };
  }
  
  return {
    finalBoxOffice: netBoxOffice,
    guaranteeApplied: false,
    guaranteeAmount
  };
}

function categorizeResult(screening, calcResult) {
  const refundResult = processRefund(screening);
  
  if (refundResult.isHighRefund && screening.totalBoxOffice > 0) {
    const refundPercent = (refundResult.refundRatio * 100).toFixed(1);
    return {
      category: 'pending',
      reason: `退票率过高 (${refundPercent}%)，需要人工确认`
    };
  }
  
  if (screening.hasMinimumGuarantee && !screening.guaranteeAmount) {
    return {
      category: 'pending',
      reason: '标记为保底协议但未填写保底金额'
    };
  }
  
  if (calcResult.finalBoxOffice < MIN_BOX_OFFICE_FOR_SUBSIDY) {
    return {
      category: 'blocked',
      reason: `票房(${calcResult.finalBoxOffice}元)未达到补贴门槛(${MIN_BOX_OFFICE_FOR_SUBSIDY}元)`
    };
  }
  
  return {
    category: 'normal',
    reason: '核算通过'
  };
}

function calculateSubsidy(screening) {
  const validation = validateScreeningData(screening);
  if (!validation.valid) {
    return {
      screeningId: screening.screeningId,
      category: validation.category,
      reason: validation.reason,
      subsidyAmount: 0,
      calculationDetails: {
        isCrossDay: screening.isCrossDay || false,
        refundDeduction: 0,
        guaranteeApplied: false,
        finalBoxOffice: 0
      }
    };
  }
  
  const refundResult = processRefund(screening);
  const guaranteeResult = applyGuarantee(screening, refundResult.netBoxOffice);
  
  let crossDaySplit = null;
  if (screening.isCrossDay) {
    crossDaySplit = calculateCrossDaySplit(
      screening.startTime,
      screening.endTime,
      guaranteeResult.finalBoxOffice
    );
  }
  
  const categoryInfo = categorizeResult(screening, guaranteeResult);
  
  const subsidyAmount = categoryInfo.category === 'normal' 
    ? Number((guaranteeResult.finalBoxOffice * SUBSIDY_RATE).toFixed(2))
    : 0;
  
  return {
    screeningId: screening.screeningId,
    cinemaId: screening.cinemaId,
    cinemaName: screening.cinemaName,
    filmId: screening.filmId,
    filmName: screening.filmName,
    category: categoryInfo.category,
    reason: categoryInfo.reason,
    subsidyAmount,
    calculationDetails: {
      isCrossDay: screening.isCrossDay || false,
      crossDaySplit,
      refundDeduction: refundResult.refundDeduction,
      refundRatio: refundResult.refundRatio,
      guaranteeApplied: guaranteeResult.guaranteeApplied,
      guaranteeAmount: guaranteeResult.guaranteeAmount,
      originalBoxOffice: screening.totalBoxOffice,
      netBoxOffice: refundResult.netBoxOffice,
      finalBoxOffice: guaranteeResult.finalBoxOffice,
      subsidyRate: SUBSIDY_RATE
    }
  };
}

function calculateBatch(rawData) {
  const results = rawData.map(screening => calculateSubsidy(screening));
  
  const summary = {
    total: results.length,
    normal: results.filter(r => r.category === 'normal').length,
    pending: results.filter(r => r.category === 'pending').length,
    blocked: results.filter(r => r.category === 'blocked').length,
    totalSubsidy: results.reduce((sum, r) => sum + r.subsidyAmount, 0)
  };
  
  return {
    results,
    summary
  };
}

module.exports = {
  calculateSubsidy,
  calculateBatch,
  SUBSIDY_RATE,
  MIN_BOX_OFFICE_FOR_SUBSIDY,
  MAX_REFUND_RATIO
};

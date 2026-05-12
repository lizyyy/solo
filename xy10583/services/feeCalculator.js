const { RATES } = require('../config');

function calculateBaseFare(distanceKm) {
  return RATES.BASE_RATE + (distanceKm * RATES.RATE_PER_KM);
}

function calculateWaitingFee(waitingMinutes) {
  const chargeableMinutes = Math.max(0, waitingMinutes - RATES.WAITING_GRACE_MINUTES);
  return chargeableMinutes * RATES.WAITING_RATE_PER_MINUTE;
}

function calculateCancellationFee(tripStatus, cancelledBy) {
  if (tripStatus === '待派单') {
    return RATES.CANCELLATION.BEFORE_DISPATCH;
  } else if (tripStatus === '已派单') {
    return RATES.CANCELLATION.AFTER_DISPATCH;
  } else if (tripStatus === '司机已到达') {
    return RATES.CANCELLATION.AFTER_ARRIVAL;
  }
  return 0;
}

function calculateIntercityFee(distanceKm, isIntercity, approvalStatus) {
  if (!isIntercity) {
    return 0;
  }
  
  if (approvalStatus === '待审批') {
    throw new Error('跨城行程需要先审批');
  }
  
  if (approvalStatus === '已拒绝') {
    throw new Error('跨城行程已被拒绝，无法继续');
  }
  
  const highwayFee = distanceKm * RATES.RATE_PER_KM * (RATES.INTERCITY.HIGHWAY_FEE_MULTIPLIER - 1);
  const perDiemFee = RATES.INTERCITY.PER_DIEM_FEE;
  
  return highwayFee + perDiemFee;
}

function calculateTotalFare(distanceKm, waitingMinutes, isIntercity, approvalStatus) {
  const baseFare = calculateBaseFare(distanceKm);
  const waitingFee = calculateWaitingFee(waitingMinutes);
  const intercityFee = calculateIntercityFee(distanceKm, isIntercity, approvalStatus);
  
  return {
    baseFare,
    waitingFee,
    intercityFee,
    total: baseFare + waitingFee + intercityFee,
    breakdown: {
      baseFare: {
        amount: baseFare,
        description: `基础车费（${RATES.BASE_RATE}元起步 + ${distanceKm}公里 × ${RATES.RATE_PER_KM}元/公里）`
      },
      waitingFee: {
        amount: waitingFee,
        description: `等待费（等待${waitingMinutes}分钟，免费${RATES.WAITING_GRACE_MINUTES}分钟，收费${Math.max(0, waitingMinutes - RATES.WAITING_GRACE_MINUTES)}分钟 × ${RATES.WAITING_RATE_PER_MINUTE}元/分钟）`
      },
      intercityFee: {
        amount: intercityFee,
        description: isIntercity ? `跨城费用（高速加价 + 住宿补贴）` : '非跨城行程，无跨城费用'
      }
    }
  };
}

function needsIntercityApproval(distanceKm) {
  return distanceKm >= RATES.INTERCITY.APPROVAL_THRESHOLD_KM;
}

function calculateDriverIncome(totalFare) {
  return totalFare * RATES.DRIVER_COMMISSION_RATE;
}

module.exports = {
  calculateBaseFare,
  calculateWaitingFee,
  calculateCancellationFee,
  calculateIntercityFee,
  calculateTotalFare,
  needsIntercityApproval,
  calculateDriverIncome
};

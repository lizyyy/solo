const db = require('../data/db');

function createClaim({ orderNo, userId, reason, expectedCompensation, idempotencyKey = null }) {
  if (!orderNo || !userId || !reason) {
    return { error: 'MISSING_PARAMS', message: '缺少必要参数' };
  }
  
  const order = db.getOrder(orderNo);
  if (!order) {
    return { error: 'ORDER_NOT_FOUND', message: '订单不存在' };
  }
  
  if (order.userId !== userId) {
    return { error: 'ORDER_MISMATCH', message: '订单不属于该用户' };
  }
  
  if (order.status === db.ORDER_STATUS.COMPLETED) {
    return { error: 'ORDER_COMPLETED', message: '已完成的订单无法申请赔付' };
  }
  
  if (order.status !== db.ORDER_STATUS.INTERRUPTED) {
    const deviceLogs = db.getDeviceLogs(order.deviceId, orderNo);
    const hasError = deviceLogs.some(l => l.event === db.DEVICE_EVENT.ERROR);
    if (!hasError) {
      return { 
        error: 'NO_DEVICE_ERROR', 
        message: '未检测到设备故障记录，申请将进入人工复核',
        needsReview: true
      };
    }
  }
  
  const result = db.createClaim(orderNo, userId, reason, expectedCompensation, idempotencyKey);
  
  if (result.claim) {
    const deviceLogs = db.getDeviceLogs(order.deviceId, orderNo);
    const hasMatchingError = deviceLogs.some(l => 
      l.event === db.DEVICE_EVENT.ERROR && 
      new Date(l.eventTime) > new Date(order.createdAt)
    );
    
    if (hasMatchingError) {
      db.updateClaimStatus(result.claim.claimNo, result.claim.status, { 
        deviceLogsMatched: true 
      });
      result.claim.deviceLogsMatched = true;
    }
  }
  
  return result;
}

function reviewClaim({ claimNo, action, actualCompensation, reviewNote = '', operator = 'admin' }) {
  const claim = db.getClaim(claimNo);
  if (!claim) {
    return { error: 'CLAIM_NOT_FOUND', message: '赔付申请不存在' };
  }
  
  if (claim.status !== db.CLAIM_STATUS.PENDING && claim.status !== db.CLAIM_STATUS.PENDING_REVIEW) {
    return { error: 'INVALID_STATUS', message: '当前状态无法审核' };
  }
  
  let newStatus;
  let extra = { reviewNote };
  
  if (action === 'approve') {
    newStatus = db.CLAIM_STATUS.APPROVED;
    extra.actualCompensation = actualCompensation || claim.expectedCompensation;
    extra.compensationType = 'coupon';
  } else if (action === 'reject') {
    newStatus = db.CLAIM_STATUS.REJECTED;
  } else if (action === 'review') {
    newStatus = db.CLAIM_STATUS.PENDING_REVIEW;
  } else {
    return { error: 'INVALID_ACTION', message: '无效的审核操作' };
  }
  
  const updatedClaim = db.updateClaimStatus(claimNo, newStatus, extra);
  db.addAuditLog('REVIEW', 'claim', claim.id, { action, operator, reviewNote }, operator);
  
  return { claim: updatedClaim };
}

function compensateClaim({ claimNo, idempotencyKey = null, operator = 'system' }) {
  const claim = db.getClaim(claimNo);
  if (!claim) {
    return { error: 'CLAIM_NOT_FOUND', message: '赔付申请不存在' };
  }
  
  if (claim.status === db.CLAIM_STATUS.COMPENSATED) {
    const existingCoupons = db.getCouponsByClaim(claimNo);
    if (existingCoupons.length > 0) {
      return { 
        duplicate: true, 
        claim,
        coupon: existingCoupons[0],
        message: '该申请已完成赔付，返回已有优惠券'
      };
    }
  }
  
  if (claim.status !== db.CLAIM_STATUS.APPROVED) {
    return { error: 'NOT_APPROVED', message: '赔付申请未通过审核' };
  }
  
  const order = db.getOrder(claim.orderNo);
  const amount = claim.actualCompensation || claim.expectedCompensation;
  
  const couponResult = db.issueCoupon(
    claim.userId, 
    amount, 
    30, 
    claimNo, 
    claim.orderNo,
    idempotencyKey
  );
  
  if (couponResult.error) {
    return couponResult;
  }
  
  const updatedClaim = db.updateClaimStatus(claimNo, db.CLAIM_STATUS.COMPENSATED, {
    couponId: couponResult.coupon.id
  });
  
  db.addAuditLog('COMPENSATE', 'claim', claim.id, { 
    couponNo: couponResult.coupon.couponNo,
    amount,
    operator
  }, operator);
  
  return {
    claim: updatedClaim,
    coupon: couponResult.coupon,
    isNew: !couponResult.duplicate
  };
}

function withdrawClaim({ claimNo, userId, reason = '' }) {
  const claim = db.getClaim(claimNo);
  if (!claim) {
    return { error: 'CLAIM_NOT_FOUND', message: '赔付申请不存在' };
  }
  
  if (claim.userId !== userId) {
    return { error: 'NOT_OWNER', message: '无权操作该申请' };
  }
  
  const allowedStatuses = [db.CLAIM_STATUS.PENDING, db.CLAIM_STATUS.PENDING_REVIEW];
  if (!allowedStatuses.includes(claim.status)) {
    return { error: 'INVALID_STATUS', message: '当前状态无法撤回' };
  }
  
  const updatedClaim = db.updateClaimStatus(claimNo, db.CLAIM_STATUS.WITHDRAWN, {
    withdrawReason: reason
  });
  
  return { claim: updatedClaim };
}

function correctClaim({ claimNo, actualCompensation, reason, operator = 'admin' }) {
  const claim = db.getClaim(claimNo);
  if (!claim) {
    return { error: 'CLAIM_NOT_FOUND', message: '赔付申请不存在' };
  }
  
  if (claim.status !== db.CLAIM_STATUS.COMPENSATED) {
    return { error: 'INVALID_STATUS', message: '仅已完成赔付的申请可修正' };
  }
  
  const existingCoupons = db.getCouponsByClaim(claimNo);
  if (existingCoupons.length > 0) {
    const oldCoupon = existingCoupons[0];
    if (oldCoupon.used) {
      return { error: 'COUPON_USED', message: '原优惠券已使用，无法修正' };
    }
  }
  
  const originalAmount = claim.actualCompensation;
  const newClaim = db.updateClaimStatus(claimNo, db.CLAIM_STATUS.CORRECTED, {
    originalCompensation: originalAmount,
    actualCompensation,
    correctionReason: reason
  });
  
  db.addAuditLog('CORRECT', 'claim', claim.id, { 
    from: originalAmount, 
    to: actualCompensation, 
    reason,
    operator
  }, operator);
  
  return { claim: newClaim };
}

function getClaimDetails(claimNo) {
  const claim = db.getClaim(claimNo);
  if (!claim) {
    return { error: 'CLAIM_NOT_FOUND', message: '赔付申请不存在' };
  }
  
  const order = db.getOrder(claim.orderNo);
  const deviceLogs = order ? db.getDeviceLogs(order.deviceId, claim.orderNo) : [];
  const coupons = db.getCouponsByClaim(claimNo);
  
  return {
    claim,
    order,
    deviceLogs,
    coupons
  };
}

function getAllClaims({ status = null, userId = null } = {}) {
  let claims = db.getAllClaims();
  
  if (status) {
    claims = claims.filter(c => c.status === status);
  }
  if (userId) {
    claims = claims.filter(c => c.userId === userId);
  }
  
  return { claims };
}

module.exports = {
  createClaim,
  reviewClaim,
  compensateClaim,
  withdrawClaim,
  correctClaim,
  getClaimDetails,
  getAllClaims
};

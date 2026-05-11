const {
  generateId,
  getPlan,
  getCoupon,
  createLog,
  findSubscription,
  findOrder,
  findRefundRequest,
  findRefundRequestsByOrder,
  saveSubscription,
  saveOrder,
  saveRefundRequest,
  REFUND_STATUS
} = require('./models');

const SUPERVISOR_THRESHOLD = 500;
const MAX_REFUND_PER_ORDER = 2;

function createSubscription(planId, userId, userName, agentId) {
  const plan = getPlan(planId);
  if (!plan) {
    return { error: 'INVALID_PLAN', message: '无效的订阅计划' };
  }

  const now = new Date();
  const trialEndAt = new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);

  const subscription = {
    id: generateId(),
    userId,
    userName,
    planId,
    planName: plan.name,
    cycleDays: plan.cycle_days,
    trialDays: plan.trial_days,
    originalPrice: plan.price,
    status: 'active',
    createdAt: now.toISOString(),
    trialEndAt: trialEndAt.toISOString(),
    expireAt: null
  };

  saveSubscription(subscription);
  createLog(agentId, 'create_subscription', 'subscription', subscription.id, {
    userId,
    userName,
    planId,
    planName: plan.name
  });

  return { data: subscription };
}

function calculateCouponDiscount(plan, couponId) {
  if (!couponId) {
    return { discount: 0, coupon: null };
  }

  const coupon = getCoupon(couponId);
  if (!coupon) {
    return { error: 'INVALID_COUPON', message: '无效的优惠券' };
  }

  if (coupon.for_yearly && !plan.is_yearly) {
    return { error: 'COUPON_NOT_APPLICABLE', message: '此优惠券仅适用于年付计划' };
  }

  if (plan.price < coupon.min_amount) {
    return { error: 'COUPON_MIN_AMOUNT', message: `订单金额不满足优惠券最低消费要求 ${coupon.min_amount} 元` };
  }

  let discount = 0;
  if (coupon.type === 'fixed') {
    discount = coupon.value;
  } else if (coupon.type === 'percentage') {
    discount = plan.price * coupon.value;
    if (coupon.max_discount && discount > coupon.max_discount) {
      discount = coupon.max_discount;
    }
  }

  discount = Math.round(discount * 100) / 100;

  return { discount, coupon };
}

function registerPayment(subscriptionId, agentId, couponId = null, paymentDate = null) {
  const subscription = findSubscription(subscriptionId);
  if (!subscription) {
    return { error: 'SUBSCRIPTION_NOT_FOUND', message: '订阅不存在' };
  }

  const plan = getPlan(subscription.planId);
  if (!plan) {
    return { error: 'INVALID_PLAN', message: '无效的订阅计划' };
  }

  const couponResult = calculateCouponDiscount(plan, couponId);
  if (couponResult.error) {
    return couponResult;
  }

  const { discount, coupon } = couponResult;
  const paidAmount = Math.max(0, plan.price - discount);
  const now = paymentDate ? new Date(paymentDate) : new Date();
  const expireAt = new Date(now.getTime() + plan.cycle_days * 24 * 60 * 60 * 1000);

  const order = {
    id: generateId(),
    subscriptionId,
    userId: subscription.userId,
    userName: subscription.userName,
    planId: subscription.planId,
    planName: subscription.planName,
    originalPrice: plan.price,
    couponId: couponId,
    couponName: coupon?.name || null,
    couponDiscount: discount,
    paidAmount: Math.round(paidAmount * 100) / 100,
    paymentDate: now.toISOString(),
    cycleStartAt: now.toISOString(),
    cycleEndAt: expireAt.toISOString(),
    status: 'paid',
    refundedAmount: 0,
    refundStatus: 'none'
  };

  saveOrder(order);

  subscription.expireAt = expireAt.toISOString();

  createLog(agentId, 'register_payment', 'order', order.id, {
    subscriptionId,
    originalPrice: plan.price,
    couponId,
    couponDiscount: discount,
    paidAmount: order.paidAmount
  });

  return { data: order };
}

function calculateUsedDays(order, refundDate) {
  const cycleStart = new Date(order.cycleStartAt);
  const now = refundDate ? new Date(refundDate) : new Date();
  const diffMs = now.getTime() - cycleStart.getTime();
  const usedDays = Math.max(0, diffMs / (24 * 60 * 60 * 1000));
  return Math.ceil(usedDays * 100) / 100;
}

function isInTrialPeriod(order, refundDate) {
  const subscription = findSubscription(order.subscriptionId);
  if (!subscription) return false;

  const now = refundDate ? new Date(refundDate) : new Date();
  return now <= new Date(subscription.trialEndAt);
}

function calculateRefundAmount(order, refundDate = null, partialDays = null) {
  const plan = getPlan(order.planId);
  if (!plan) {
    return { error: 'INVALID_PLAN', message: '无效的订阅计划' };
  }

  const usedDays = partialDays !== null ? partialDays : calculateUsedDays(order, refundDate);
  const inTrial = isInTrialPeriod(order, refundDate);

  if (inTrial && usedDays <= plan.trial_days) {
    return {
      refundAmount: order.paidAmount,
      usedDays: 0,
      trialUsed: true,
      details: '试用期内全额退款'
    };
  }

  let dailyRate;
  if (plan.is_yearly) {
    dailyRate = order.paidAmount / plan.cycle_days;
  } else {
    dailyRate = order.paidAmount / plan.cycle_days;
  }

  const usedAmount = usedDays * dailyRate;
  let refundAmount = order.paidAmount - usedAmount;

  refundAmount = Math.max(0, Math.round(refundAmount * 100) / 100);

  return {
    refundAmount,
    usedDays: Math.ceil(usedDays * 100) / 100,
    usedAmount: Math.round(usedAmount * 100) / 100,
    dailyRate: Math.round(dailyRate * 10000) / 10000,
    trialUsed: inTrial,
    details: plan.is_yearly ? '年付按实际使用天数折算' : '月付按实际使用天数折算'
  };
}

function canSubmitRefund(order) {
  if (order.status !== 'paid') {
    return { canRefund: false, reason: 'ORDER_NOT_PAID', message: '订单未支付' };
  }

  const existingRequests = findRefundRequestsByOrder(order.id);
  const approvedCount = existingRequests.filter(
    r => r.status === REFUND_STATUS.APPROVED
  ).length;

  if (approvedCount >= MAX_REFUND_PER_ORDER) {
    return { canRefund: false, reason: 'MAX_REFUND_REACHED', message: `同一订单最多只能退款 ${MAX_REFUND_PER_ORDER} 次` };
  }

  const pendingCount = existingRequests.filter(
    r => r.status === REFUND_STATUS.PENDING || r.status === REFUND_STATUS.NEEDS_SUPERVISOR
  ).length;

  if (pendingCount > 0) {
    return { canRefund: false, reason: 'PENDING_EXISTS', message: '该订单已有未处理的退款申请' };
  }

  const totalRefunded = existingRequests
    .filter(r => r.status === REFUND_STATUS.APPROVED)
    .reduce((sum, r) => sum + r.refundAmount, 0);

  if (totalRefunded >= order.paidAmount) {
    return { canRefund: false, reason: 'ALREADY_FULLY_REFUNDED', message: '该订单已全额退款' };
  }

  return { canRefund: true, totalRefunded: Math.round(totalRefunded * 100) / 100 };
}

function findDuplicateRefund(orderId, agentId, refundAmount, createdAtWindow = 5 * 60 * 1000) {
  const existingRequests = findRefundRequestsByOrder(orderId);
  const now = Date.now();

  return existingRequests.find(r => {
    if (r.agentId !== agentId) return false;
    if (Math.abs(r.refundAmount - refundAmount) > 0.01) return false;
    const requestTime = new Date(r.createdAt).getTime();
    return Math.abs(now - requestTime) <= createdAtWindow;
  });
}

function submitRefundRequest(orderId, agentId, reason, refundDate = null, partialDays = null, idempotencyKey = null) {
  const order = findOrder(orderId);
  if (!order) {
    return { error: 'ORDER_NOT_FOUND', message: '订单不存在' };
  }

  const canRefundResult = canSubmitRefund(order);
  if (!canRefundResult.canRefund) {
    return canRefundResult;
  }

  const calcResult = calculateRefundAmount(order, refundDate, partialDays);
  if (calcResult.error) {
    return calcResult;
  }

  const netRefundAmount = calcResult.refundAmount - canRefundResult.totalRefunded;
  const finalRefundAmount = Math.max(0, Math.round(netRefundAmount * 100) / 100);

  if (finalRefundAmount > 0) {
    const duplicate = findDuplicateRefund(orderId, agentId, finalRefundAmount);
    if (duplicate) {
      return {
        data: duplicate,
        isDuplicate: true,
        message: '检测到重复请求，返回已有申请（幂等处理）'
      };
    }
  }

  const needsSupervisor = finalRefundAmount >= SUPERVISOR_THRESHOLD;
  const status = needsSupervisor ? REFUND_STATUS.NEEDS_SUPERVISOR :
    finalRefundAmount > 0 ? REFUND_STATUS.PENDING : REFUND_STATUS.APPROVED;

  const request = {
    id: generateId(),
    orderId,
    subscriptionId: order.subscriptionId,
    userId: order.userId,
    userName: order.userName,
    agentId,
    reason,
    originalOrderPrice: order.originalPrice,
    couponDiscount: order.couponDiscount,
    paidAmount: order.paidAmount,
    usedDays: calcResult.usedDays,
    usedAmount: calcResult.usedAmount || 0,
    refundAmount: finalRefundAmount,
    details: calcResult.details,
    isZeroRefund: finalRefundAmount === 0,
    status,
    needsSupervisor,
    supervisorDecision: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    idempotencyKey: idempotencyKey || generateId()
  };

  saveRefundRequest(request);
  createLog(agentId, 'submit_refund', 'refund_request', request.id, {
    orderId,
    refundAmount: finalRefundAmount,
    reason,
    needsSupervisor
  });

  if (finalRefundAmount === 0) {
    order.refundStatus = 'partial_refunded';
    request.reviewedAt = request.createdAt;
    request.autoApproved = true;
  }

  return { data: request, isDuplicate: false };
}

function tryCalculateRefund(orderId, refundDate = null, partialDays = null) {
  const order = findOrder(orderId);
  if (!order) {
    return { error: 'ORDER_NOT_FOUND', message: '订单不存在' };
  }

  const canRefundResult = canSubmitRefund(order);
  const calcResult = calculateRefundAmount(order, refundDate, partialDays);

  if (calcResult.error) {
    return calcResult;
  }

  const netRefundAmount = calcResult.refundAmount - (canRefundResult.totalRefunded || 0);
  const finalRefundAmount = Math.max(0, Math.round(netRefundAmount * 100) / 100);

  return {
    order: {
      id: order.id,
      planName: order.planName,
      originalPrice: order.originalPrice,
      couponDiscount: order.couponDiscount,
      paidAmount: order.paidAmount,
      paymentDate: order.paymentDate,
      cycleEndAt: order.cycleEndAt
    },
    calculation: {
      usedDays: calcResult.usedDays,
      usedAmount: calcResult.usedAmount || 0,
      dailyRate: calcResult.dailyRate || 0,
      trialUsed: calcResult.trialUsed,
      details: calcResult.details
    },
    refundAmount: finalRefundAmount,
    totalRefunded: canRefundResult.totalRefunded || 0,
    canRefund: canRefundResult.canRefund,
    canRefundReason: canRefundResult.canRefund ? null : canRefundResult.reason,
    canRefundMessage: canRefundResult.canRefund ? null : canRefundResult.message,
    needsSupervisor: finalRefundAmount >= SUPERVISOR_THRESHOLD,
    isZeroRefund: finalRefundAmount === 0
  };
}

function reviewRefundRequest(refundId, agentId, approved, supervisorNote = null) {
  const request = findRefundRequest(refundId);
  if (!request) {
    return { error: 'REFUND_NOT_FOUND', message: '退款申请不存在' };
  }

  if (request.status === REFUND_STATUS.APPROVED || request.status === REFUND_STATUS.REJECTED) {
    return {
      error: 'ALREADY_REVIEWED',
      message: '该退款申请已处理',
      data: request
    };
  }

  const agent = require('./models').getAgent(agentId);
  if (request.needsSupervisor && agent?.role !== 'supervisor') {
    return { error: 'NEEDS_SUPERVISOR', message: '该退款申请需要主管审批' };
  }

  const order = findOrder(request.orderId);
  if (!order) {
    return { error: 'ORDER_NOT_FOUND', message: '订单不存在' };
  }

  const now = new Date();

  if (approved) {
    request.status = REFUND_STATUS.APPROVED;
    request.reviewedAt = now.toISOString();
    request.supervisorDecision = 'approved';
    request.supervisorNote = supervisorNote;

    order.refundedAmount = Math.round((order.refundedAmount + request.refundAmount) * 100) / 100;

    if (order.refundedAmount >= order.paidAmount - 0.01) {
      order.refundStatus = 'full_refunded';
    } else {
      order.refundStatus = 'partial_refunded';
    }
  } else {
    request.status = REFUND_STATUS.REJECTED;
    request.reviewedAt = now.toISOString();
    request.supervisorDecision = 'rejected';
    request.supervisorNote = supervisorNote;
  }

  createLog(agentId, approved ? 'approve_refund' : 'reject_refund', 'refund_request', request.id, {
    orderId: request.orderId,
    refundAmount: request.refundAmount,
    supervisorNote
  });

  return { data: request };
}

function getReconciliation(date = null) {
  const targetDate = date ? new Date(date) : new Date();
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();

  const startOfDay = new Date(year, month, day, 0, 0, 0).getTime();
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999).getTime();

  const isInDate = (isoString) => {
    const time = new Date(isoString).getTime();
    return time >= startOfDay && time <= endOfDay;
  };

  const dayRequests = require('./models').STORE.refundRequests.filter(r => isInDate(r.createdAt));

  const totalRefundAmount = dayRequests
    .filter(r => r.status === REFUND_STATUS.APPROVED)
    .reduce((sum, r) => sum + r.refundAmount, 0);

  const pendingCount = dayRequests.filter(
    r => r.status === REFUND_STATUS.PENDING || r.status === REFUND_STATUS.NEEDS_SUPERVISOR
  ).length;

  const anomalies = [];

  dayRequests.forEach(r => {
    if (r.isZeroRefund && r.status === REFUND_STATUS.APPROVED) {
      anomalies.push({
        refundId: r.id,
        orderId: r.orderId,
        userName: r.userName,
        type: 'ZERO_REFUND',
        message: '退款金额为0元，已自动处理'
      });
    }
    if (r.status === REFUND_STATUS.NEEDS_SUPERVISOR) {
      anomalies.push({
        refundId: r.id,
        orderId: r.orderId,
        userName: r.userName,
        refundAmount: r.refundAmount,
        type: 'NEEDS_SUPERVISOR_REVIEW',
        message: `退款金额 ${r.refundAmount} 元超过 ${SUPERVISOR_THRESHOLD} 元，需主管审批`
      });
    }
  });

  const orderIds = [...new Set(dayRequests.map(r => r.orderId))];
  orderIds.forEach(orderId => {
    const orderRequests = dayRequests.filter(r => r.orderId === orderId);
    if (orderRequests.length > 1) {
      anomalies.push({
        orderId,
        refundCount: orderRequests.length,
        type: 'MULTIPLE_REQUESTS',
        message: `同一订单有 ${orderRequests.length} 次退款申请`
      });
    }
  });

  return {
    date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    summary: {
      totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
      pendingCount,
      totalRequests: dayRequests.length,
      approvedCount: dayRequests.filter(r => r.status === REFUND_STATUS.APPROVED).length,
      rejectedCount: dayRequests.filter(r => r.status === REFUND_STATUS.REJECTED).length
    },
    anomalies: anomalies.length > 0 ? anomalies : [],
    refundDetails: dayRequests.map(r => ({
      id: r.id,
      orderId: r.orderId,
      userName: r.userName,
      refundAmount: r.refundAmount,
      status: r.status,
      needsSupervisor: r.needsSupervisor,
      isZeroRefund: r.isZeroRefund,
      createdAt: r.createdAt
    }))
  };
}

function getLogs(targetType = null, targetId = null) {
  const logs = require('./models').STORE.operationLogs;
  let filtered = [...logs].reverse();

  if (targetType) {
    filtered = filtered.filter(l => l.targetType === targetType);
  }
  if (targetId) {
    filtered = filtered.filter(l => l.targetId === targetId);
  }

  return filtered;
}

module.exports = {
  createSubscription,
  registerPayment,
  submitRefundRequest,
  tryCalculateRefund,
  reviewRefundRequest,
  getReconciliation,
  getLogs,
  calculateRefundAmount
};

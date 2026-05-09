const crypto = require('crypto');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.randomBytes(1)[0] % 16;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const db = {
  orders: [],
  deviceLogs: [],
  claims: [],
  coupons: [],
  auditLogs: [],
  nextId: {
    order: 1001,
    claim: 2001,
    coupon: 3001
  }
};

const ORDER_STATUS = {
  CREATED: 'created',
  PAID: 'paid',
  WASHING: 'washing',
  INTERRUPTED: 'interrupted',
  COMPLETED: 'completed',
  REFUNDED: 'refunded'
};

const CLAIM_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PENDING_REVIEW: 'pending_review',
  COMPENSATED: 'compensated',
  WITHDRAWN: 'withdrawn',
  CORRECTED: 'corrected'
};

const DEVICE_EVENT = {
  START: 'start',
  WATER_FILL: 'water_fill',
  HEATING: 'heating',
  WASH_CYCLE: 'wash_cycle',
  RINSE: 'rinse',
  SPIN: 'spin',
  ERROR: 'error',
  STOP: 'stop',
  RESTART: 'restart'
};

const ERROR_CODES = {
  E101: '水压异常',
  E102: '水温异常',
  E103: '门锁故障',
  E201: '电机过载',
  E202: '转速异常',
  E301: '通信中断',
  E999: '未知故障'
};

function generateOrderNo() {
  return `ORD${Date.now().toString().slice(-8)}${String(db.nextId.order++).padStart(4, '0')}`;
}

function generateClaimNo() {
  return `CLM${Date.now().toString().slice(-8)}${String(db.nextId.claim++).padStart(4, '0')}`;
}

function generateCouponNo() {
  return `CPN${Date.now().toString().slice(-8)}${String(db.nextId.coupon++).padStart(4, '0')}`;
}

function now() {
  return new Date().toISOString();
}

function addAuditLog(action, entityType, entityId, details = {}, operator = 'system') {
  db.auditLogs.push({
    id: uuidv4(),
    action,
    entityType,
    entityId,
    details,
    operator,
    createdAt: now()
  });
}

function createOrder(userId, deviceId, amount, washType = 'standard', duration = 45) {
  const orderNo = generateOrderNo();
  const order = {
    id: uuidv4(),
    orderNo,
    userId,
    deviceId,
    amount,
    washType,
    duration,
    status: ORDER_STATUS.CREATED,
    progress: 0,
    interruptedAt: null,
    errorCode: null,
    createdAt: now(),
    updatedAt: now(),
    version: 1
  };
  db.orders.push(order);
  addAuditLog('CREATE', 'order', order.id, { orderNo, deviceId, amount });
  return order;
}

function updateOrderStatus(orderNo, status, extra = {}) {
  const order = db.orders.find(o => o.orderNo === orderNo);
  if (!order) return null;
  order.status = status;
  order.updatedAt = now();
  order.version += 1;
  Object.assign(order, extra);
  addAuditLog('UPDATE_STATUS', 'order', order.id, { from: order.status, to: status, ...extra });
  return order;
}

function getOrder(orderNo) {
  return db.orders.find(o => o.orderNo === orderNo);
}

function getOrderById(id) {
  return db.orders.find(o => o.id === id);
}

function addDeviceLog(deviceId, event, orderNo = null, details = {}) {
  const log = {
    id: uuidv4(),
    deviceId,
    orderNo,
    event,
    eventTime: now(),
    details,
    createdAt: now()
  };
  db.deviceLogs.push(log);
  return log;
}

function getDeviceLogs(deviceId, orderNo = null) {
  let logs = db.deviceLogs.filter(l => l.deviceId === deviceId);
  if (orderNo) logs = logs.filter(l => l.orderNo === orderNo);
  return logs.sort((a, b) => new Date(a.eventTime) - new Date(b.eventTime));
}

function createClaim(orderNo, userId, reason, expectedCompensation, idempotencyKey = null) {
  const order = getOrder(orderNo);
  if (!order) {
    return { error: 'ORDER_NOT_FOUND', message: '订单不存在' };
  }
  
  if (idempotencyKey) {
    const existing = db.claims.find(c => c.idempotencyKey === idempotencyKey);
    if (existing) {
      return { duplicate: true, claim: existing };
    }
  }
  
  const existingClaims = db.claims.filter(c => c.orderNo === orderNo && 
    c.status !== CLAIM_STATUS.WITHDRAWN && c.status !== CLAIM_STATUS.REJECTED);
  
  if (existingClaims.length > 0) {
    return { 
      error: 'DUPLICATE_CLAIM', 
      message: '该订单已有进行中的赔付申请',
      existingClaim: existingClaims[0]
    };
  }
  
  const claimNo = generateClaimNo();
  const claim = {
    id: uuidv4(),
    claimNo,
    orderNo,
    userId,
    reason,
    expectedCompensation,
    actualCompensation: null,
    compensationType: null,
    status: CLAIM_STATUS.PENDING,
    idempotencyKey,
    deviceLogsMatched: false,
    reviewNote: null,
    couponId: null,
    createdAt: now(),
    updatedAt: now(),
    version: 1
  };
  
  db.claims.push(claim);
  addAuditLog('CREATE', 'claim', claim.id, { claimNo, orderNo, reason, expectedCompensation });
  
  return { claim };
}

function updateClaimStatus(claimNo, status, extra = {}) {
  const claim = db.claims.find(c => c.claimNo === claimNo);
  if (!claim) return null;
  
  claim.status = status;
  claim.updatedAt = now();
  claim.version += 1;
  Object.assign(claim, extra);
  
  addAuditLog('UPDATE_STATUS', 'claim', claim.id, { status, ...extra });
  return claim;
}

function getClaim(claimNo) {
  return db.claims.find(c => c.claimNo === claimNo);
}

function getClaimByOrder(orderNo) {
  return db.claims.filter(c => c.orderNo === orderNo);
}

function getClaimsByUser(userId) {
  return db.claims.filter(c => c.userId === userId);
}

function getAllClaims() {
  return [...db.claims];
}

function issueCoupon(userId, amount, validDays = 30, claimNo = null, orderNo = null, idempotencyKey = null) {
  if (idempotencyKey) {
    const existing = db.coupons.find(c => c.idempotencyKey === idempotencyKey);
    if (existing) {
      return { duplicate: true, coupon: existing };
    }
  }
  
  if (claimNo) {
    const claimCoupon = db.coupons.find(c => c.claimNo === claimNo);
    if (claimCoupon) {
      return { 
        error: 'COUPON_ALREADY_ISSUED', 
        message: '该赔付申请已发放过优惠券',
        coupon: claimCoupon
      };
    }
  }
  
  const couponNo = generateCouponNo();
  const validFrom = now();
  const validTo = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
  
  const coupon = {
    id: uuidv4(),
    couponNo,
    userId,
    amount,
    validFrom,
    validTo,
    used: false,
    usedAt: null,
    claimNo,
    orderNo,
    idempotencyKey,
    createdAt: now()
  };
  
  db.coupons.push(coupon);
  addAuditLog('ISSUE', 'coupon', coupon.id, { couponNo, amount, claimNo, orderNo });
  
  return { coupon };
}

function getCoupon(couponNo) {
  return db.coupons.find(c => c.couponNo === couponNo);
}

function getCouponsByUser(userId) {
  return db.coupons.filter(c => c.userId === userId);
}

function getCouponsByClaim(claimNo) {
  return db.coupons.filter(c => c.claimNo === claimNo);
}

function getStatistics(dateFrom = null, dateTo = null) {
  let claims = [...db.claims];
  let orders = [...db.orders];
  let coupons = [...db.coupons];
  
  if (dateFrom) {
    claims = claims.filter(c => new Date(c.createdAt) >= new Date(dateFrom));
    orders = orders.filter(o => new Date(o.createdAt) >= new Date(dateFrom));
    coupons = coupons.filter(c => new Date(c.createdAt) >= new Date(dateFrom));
  }
  
  if (dateTo) {
    claims = claims.filter(c => new Date(c.createdAt) <= new Date(dateTo));
    orders = orders.filter(o => new Date(o.createdAt) <= new Date(dateTo));
    coupons = coupons.filter(c => new Date(c.createdAt) <= new Date(dateTo));
  }
  
  const totalOrders = orders.length;
  const interruptedOrders = orders.filter(o => o.status === ORDER_STATUS.INTERRUPTED).length;
  const totalClaims = claims.length;
  const pendingClaims = claims.filter(c => c.status === CLAIM_STATUS.PENDING).length;
  const pendingReviewClaims = claims.filter(c => c.status === CLAIM_STATUS.PENDING_REVIEW).length;
  const approvedClaims = claims.filter(c => 
    [CLAIM_STATUS.APPROVED, CLAIM_STATUS.COMPENSATED].includes(c.status)
  ).length;
  const rejectedClaims = claims.filter(c => c.status === CLAIM_STATUS.REJECTED).length;
  
  const totalCompensation = coupons.reduce((sum, c) => sum + c.amount, 0);
  const avgCompensation = coupons.length > 0 ? totalCompensation / coupons.length : 0;
  
  const deviceFailures = {};
  db.deviceLogs
    .filter(l => l.event === DEVICE_EVENT.ERROR)
    .forEach(l => {
      deviceFailures[l.deviceId] = (deviceFailures[l.deviceId] || 0) + 1;
    });
  
  return {
    period: { from: dateFrom, to: dateTo },
    orders: {
      total: totalOrders,
      interrupted: interruptedOrders,
      interruptionRate: totalOrders > 0 ? (interruptedOrders / totalOrders * 100).toFixed(2) + '%' : '0%'
    },
    claims: {
      total: totalClaims,
      pending: pendingClaims,
      pendingReview: pendingReviewClaims,
      approved: approvedClaims,
      rejected: rejectedClaims,
      approvalRate: totalClaims > 0 ? (approvedClaims / totalClaims * 100).toFixed(2) + '%' : '0%'
    },
    compensation: {
      totalCoupons: coupons.length,
      totalAmount: totalCompensation,
      avgAmount: avgCompensation.toFixed(2)
    },
    deviceFailures
  };
}

function exportAllData() {
  return {
    orders: db.orders,
    deviceLogs: db.deviceLogs,
    claims: db.claims,
    coupons: db.coupons,
    auditLogs: db.auditLogs
  };
}

function reset() {
  db.orders = [];
  db.deviceLogs = [];
  db.claims = [];
  db.coupons = [];
  db.auditLogs = [];
  db.nextId = { order: 1001, claim: 2001, coupon: 3001 };
}

module.exports = {
  db,
  ORDER_STATUS,
  CLAIM_STATUS,
  DEVICE_EVENT,
  ERROR_CODES,
  createOrder,
  updateOrderStatus,
  getOrder,
  getOrderById,
  addDeviceLog,
  getDeviceLogs,
  createClaim,
  updateClaimStatus,
  getClaim,
  getClaimByOrder,
  getClaimsByUser,
  getAllClaims,
  issueCoupon,
  getCoupon,
  getCouponsByUser,
  getCouponsByClaim,
  getStatistics,
  exportAllData,
  reset,
  addAuditLog
};

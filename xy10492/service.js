const { stores, coupons, redeemRequests, auditLogs, statistics, generateCode } = require('./storage');

const errorTypes = {
  COUPON_NOT_FOUND: { code: 'COUPON_NOT_FOUND', message: '券码不存在', type: 'USER' },
  COUPON_EXPIRED: { code: 'COUPON_EXPIRED', message: '券码已过期', type: 'USER' },
  COUPON_NOT_YET_VALID: { code: 'COUPON_NOT_YET_VALID', message: '券码尚未生效', type: 'USER' },
  COUPON_REFUNDED: { code: 'COUPON_REFUNDED', message: '券码已退款', type: 'USER' },
  COUPON_REDEEMED: { code: 'COUPON_REDEEMED', message: '券码已核销', type: 'USER' },
  STORE_NOT_FOUND: { code: 'STORE_NOT_FOUND', message: '门店不存在', type: 'SYSTEM' },
  STORE_NOT_ALLOWED: { code: 'STORE_NOT_ALLOWED', message: '该门店无权核销此券码', type: 'STORE' },
  CATEGORY_MISMATCH: { code: 'CATEGORY_MISMATCH', message: '门店品类与券码品类不匹配', type: 'STORE' },
  REQUEST_DUPLICATE: { code: 'REQUEST_DUPLICATE', message: '请求重复提交', type: 'SYSTEM' }
};

function logAudit(couponId, storeId, action, result, details = {}) {
  const logId = `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  auditLogs.set(logId, {
    id: logId,
    couponId,
    storeId,
    action,
    result,
    timestamp: new Date(),
    ...details
  });
}

function validateCoupon(coupon) {
  const now = new Date();
  
  if (coupon.status === 'REFUNDED') {
    statistics.refundBlocked++;
    return { success: false, error: errorTypes.COUPON_REFUNDED };
  }
  
  if (coupon.status === 'REDEEMED') {
    return { success: false, error: errorTypes.COUPON_REDEEMED };
  }
  
  if (now < coupon.validFrom) {
    return { success: false, error: errorTypes.COUPON_NOT_YET_VALID };
  }
  
  if (now > coupon.validTo) {
    return { success: false, error: errorTypes.COUPON_EXPIRED };
  }
  
  return { success: true };
}

function validateStorePermission(coupon, store) {
  if (!coupon.boundStores.includes(store.id)) {
    statistics.abnormalCodes.add(coupon.id);
    statistics.pendingReview.add({
      couponId: coupon.id,
      storeId: store.id,
      reason: '跨门店核销尝试',
      type: 'STORE'
    });
    return { success: false, error: errorTypes.STORE_NOT_ALLOWED };
  }
  
  if (!store.allowedCategories.includes(coupon.category)) {
    statistics.abnormalCodes.add(coupon.id);
    statistics.pendingReview.add({
      couponId: coupon.id,
      storeId: store.id,
      reason: '品类不匹配',
      type: 'STORE'
    });
    return { success: false, error: errorTypes.CATEGORY_MISMATCH };
  }
  
  return { success: true };
}

function checkIdempotency(requestId) {
  return redeemRequests.has(requestId);
}

function createCoupon(data) {
  const id = `COUP${Date.now()}`;
  const code = data.code || generateCode(data.category || 'GEN', data.name || '券');
  
  const coupon = {
    id,
    code,
    name: data.name || '代金券',
    category: data.category || 'GENERAL',
    value: data.value || 0,
    validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
    validTo: data.validTo ? new Date(data.validTo) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    boundStores: data.boundStores || [],
    status: 'ACTIVE',
    redeemedAt: null,
    redeemedBy: null,
    refundedAt: null,
    createdAt: new Date()
  };
  
  coupons.set(id, coupon);
  logAudit(id, null, 'CREATE', 'SUCCESS', { coupon });
  return coupon;
}

function bindStores(couponId, storeIds) {
  const coupon = coupons.get(couponId);
  if (!coupon) {
    return { success: false, error: errorTypes.COUPON_NOT_FOUND };
  }
  
  for (const storeId of storeIds) {
    if (!stores.has(storeId)) {
      return { success: false, error: { ...errorTypes.STORE_NOT_FOUND, message: `门店 ${storeId} 不存在` } };
    }
  }
  
  coupon.boundStores = [...new Set([...coupon.boundStores, ...storeIds])];
  logAudit(couponId, null, 'BIND_STORES', 'SUCCESS', { storeIds });
  return { success: true, coupon };
}

function refundCoupon(couponId) {
  const coupon = coupons.get(couponId);
  if (!coupon) {
    return { success: false, error: errorTypes.COUPON_NOT_FOUND };
  }
  
  if (coupon.status === 'REDEEMED') {
    return { success: false, error: { code: 'ALREADY_REDEEMED', message: '已核销的券码不能退款', type: 'USER' } };
  }
  
  if (coupon.status === 'REFUNDED') {
    return { success: false, error: { code: 'ALREADY_REFUNDED', message: '券码已退款', type: 'USER' } };
  }
  
  coupon.status = 'REFUNDED';
  coupon.refundedAt = new Date();
  logAudit(couponId, null, 'REFUND', 'SUCCESS');
  return { success: true, coupon };
}

function redeemCoupon(couponCode, storeId, requestId) {
  if (requestId && checkIdempotency(requestId)) {
    const prev = redeemRequests.get(requestId);
    return prev.result;
  }
  
  let coupon = null;
  for (const c of coupons.values()) {
    if (c.code === couponCode) {
      coupon = c;
      break;
    }
  }
  
  if (!coupon) {
    const result = { success: false, error: errorTypes.COUPON_NOT_FOUND };
    if (requestId) {
      redeemRequests.set(requestId, { requestId, result, timestamp: new Date() });
    }
    statistics.abnormalCodes.add(couponCode);
    return result;
  }
  
  const store = stores.get(storeId);
  if (!store) {
    const result = { success: false, error: errorTypes.STORE_NOT_FOUND };
    if (requestId) {
      redeemRequests.set(requestId, { requestId, result, timestamp: new Date() });
    }
    return result;
  }
  
  const couponCheck = validateCoupon(coupon);
  if (!couponCheck.success) {
    const result = couponCheck;
    if (requestId) {
      redeemRequests.set(requestId, { requestId, result, timestamp: new Date() });
    }
    logAudit(coupon.id, storeId, 'REDEEM', 'FAILED', { error: couponCheck.error });
    if (couponCheck.error.code === 'COUPON_REFUNDED') {
      statistics.abnormalCodes.add(coupon.id);
    }
    return result;
  }
  
  const storeCheck = validateStorePermission(coupon, store);
  if (!storeCheck.success) {
    const result = storeCheck;
    if (requestId) {
      redeemRequests.set(requestId, { requestId, result, timestamp: new Date() });
    }
    logAudit(coupon.id, storeId, 'REDEEM', 'FAILED', { error: storeCheck.error });
    return result;
  }
  
  coupon.status = 'REDEEMED';
  coupon.redeemedAt = new Date();
  coupon.redeemedBy = storeId;
  
  statistics.totalRedeemed++;
  
  const result = { success: true, coupon };
  
  if (requestId) {
    redeemRequests.set(requestId, { requestId, result, timestamp: new Date() });
  }
  
  logAudit(coupon.id, storeId, 'REDEEM', 'SUCCESS');
  
  return result;
}

function queryAbnormal(couponId) {
  const logs = [];
  for (const log of auditLogs.values()) {
    if (log.couponId === couponId && log.result === 'FAILED') {
      logs.push(log);
    }
  }
  return logs;
}

function getStatistics() {
  const storeStats = new Map();
  
  for (const coupon of coupons.values()) {
    if (coupon.status === 'REDEEMED' && coupon.redeemedBy) {
      const storeId = coupon.redeemedBy;
      if (!storeStats.has(storeId)) {
        storeStats.set(storeId, {
          storeId,
          storeName: stores.get(storeId)?.name || storeId,
          redeemedCount: 0,
          totalValue: 0
        });
      }
      storeStats.get(storeId).redeemedCount++;
      storeStats.get(storeId).totalValue += coupon.value;
    }
  }
  
  const pendingItems = [];
  for (const item of statistics.pendingReview) {
    pendingItems.push({
      ...item,
      couponCode: coupons.get(item.couponId)?.code,
      storeName: stores.get(item.storeId)?.name
    });
  }
  
  const abnormalDetails = [];
  for (const code of statistics.abnormalCodes) {
    const logs = queryAbnormal(typeof code === 'string' ? code : code.couponId || code.id);
    const coupon = coupons.get(typeof code === 'string' ? code : code.couponId || code.id);
    abnormalDetails.push({
      code: coupon?.code || code,
      couponId: coupon?.id || code,
      failedAttempts: logs.length,
      lastError: logs[logs.length - 1]?.error
    });
  }
  
  return {
    totalRedeemed: statistics.totalRedeemed,
    storeRedeemStats: Array.from(storeStats.values()),
    abnormalCodes: abnormalDetails,
    refundBlockedCount: statistics.refundBlocked,
    pendingReviewCount: pendingItems.length,
    pendingReviewItems: pendingItems
  };
}

module.exports = {
  createCoupon,
  bindStores,
  refundCoupon,
  redeemCoupon,
  queryAbnormal,
  getStatistics,
  checkIdempotency
};

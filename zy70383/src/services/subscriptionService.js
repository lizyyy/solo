const { SUBSCRIPTION_STATUS, EVENT_DIRECTORY, CUSTOMER_PLANS, subscriptions, deliveryStats, verificationTokens } = require('../data/models');
const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function getEventInfo(eventId) {
  return EVENT_DIRECTORY.find(e => e.eventId === eventId);
}

function getCustomerInfo(customerId) {
  return CUSTOMER_PLANS[customerId];
}

function checkEventPermission(customerId, eventId) {
  const customer = getCustomerInfo(customerId);
  const event = getEventInfo(eventId);
  
  if (!customer) return { allowed: false, reason: `客户 ${customerId} 不存在` };
  if (!event) return { allowed: false, reason: `事件 ${eventId} 不存在` };
  
  if (!event.allowedPlans.includes(customer.plan)) {
    return {
      allowed: false,
      reason: `客户套餐(${customer.plan})无权限订阅该事件，仅允许套餐: ${event.allowedPlans.join(', ')}`,
      customerPlan: customer.plan,
      allowedPlans: event.allowedPlans
    };
  }
  
  return { allowed: true, eventName: event.name };
}

function checkTenantScope(customerId, requestedTenants) {
  const customer = getCustomerInfo(customerId);
  if (!customer) return { allowed: false, reason: `客户 ${customerId} 不存在` };
  
  const invalidTenants = requestedTenants.filter(t => !customer.allowedTenants.includes(t));
  if (invalidTenants.length > 0) {
    return {
      allowed: false,
      reason: `订阅范围超出授权租户：${invalidTenants.join(', ')}，客户仅允许：${customer.allowedTenants.join(', ')}`,
      requested: requestedTenants,
      allowed: customer.allowedTenants
    };
  }
  
  return { allowed: true };
}

function checkDuplicateSubscription(customerId, eventId) {
  const key = `${customerId}:${eventId}`;
  const existing = subscriptions.get(key);
  
  if (existing) {
    return {
      exists: true,
      subscription: existing,
      reason: `客户 ${customerId} 已订阅事件 ${eventId}，当前状态: ${existing.status}`
    };
  }
  
  return { exists: false };
}

function createSubscription(customerId, eventId, callbackUrl, tenants) {
  const eventPermission = checkEventPermission(customerId, eventId);
  if (!eventPermission.allowed) {
    return {
      success: false,
      status: SUBSCRIPTION_STATUS.NO_PERMISSION,
      errorCode: 'INSUFFICIENT_PLAN',
      message: eventPermission.reason,
      details: eventPermission
    };
  }
  
  const tenantCheck = checkTenantScope(customerId, tenants);
  if (!tenantCheck.allowed) {
    return {
      success: false,
      status: SUBSCRIPTION_STATUS.NO_PERMISSION,
      errorCode: 'TENANT_SCOPE_EXCEEDED',
      message: tenantCheck.reason,
      details: tenantCheck
    };
  }
  
  const duplicateCheck = checkDuplicateSubscription(customerId, eventId);
  if (duplicateCheck.exists) {
    return {
      success: false,
      errorCode: 'DUPLICATE_SUBSCRIPTION',
      message: duplicateCheck.reason,
      existingStatus: duplicateCheck.subscription.status,
      subscription: duplicateCheck.subscription
    };
  }
  
  const token = generateToken();
  const key = `${customerId}:${eventId}`;
  
  const subscription = {
    subscriptionId: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    customerId,
    eventId,
    eventName: eventPermission.eventName,
    callbackUrl,
    tenants,
    status: SUBSCRIPTION_STATUS.PENDING_VERIFICATION,
    verificationToken: token,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statusHistory: [
      { status: SUBSCRIPTION_STATUS.PENDING_VERIFICATION, time: new Date().toISOString(), reason: '订阅申请创建' }
    ]
  };
  
  subscriptions.set(key, subscription);
  verificationTokens.set(token, { customerId, eventId, expiresAt: Date.now() + 3600000 });
  
  return {
    success: true,
    status: SUBSCRIPTION_STATUS.PENDING_VERIFICATION,
    message: '订阅申请已创建，请完成回调验证',
    subscription,
    verificationToken: token
  };
}

function verifySubscription(customerId, eventId, token) {
  const key = `${customerId}:${eventId}`;
  const subscription = subscriptions.get(key);
  
  if (!subscription) {
    return {
      success: false,
      errorCode: 'SUBSCRIPTION_NOT_FOUND',
      message: `未找到客户 ${customerId} 对事件 ${eventId} 的订阅`
    };
  }
  
  if (subscription.status !== SUBSCRIPTION_STATUS.PENDING_VERIFICATION) {
    return {
      success: false,
      errorCode: 'INVALID_STATUS',
      message: `当前订阅状态(${subscription.status})不允许验证操作`,
      currentStatus: subscription.status
    };
  }
  
  if (subscription.verificationToken !== token) {
    subscription.status = SUBSCRIPTION_STATUS.VERIFICATION_FAILED;
    subscription.updatedAt = new Date().toISOString();
    subscription.statusHistory.push({
      status: SUBSCRIPTION_STATUS.VERIFICATION_FAILED,
      time: new Date().toISOString(),
      reason: '回调验证失败：token不匹配'
    });
    subscriptions.set(key, subscription);
    
    return {
      success: false,
      errorCode: 'VERIFICATION_FAILED',
      message: '回调验证失败：token不匹配',
      subscription
    };
  }
  
  const tokenInfo = verificationTokens.get(token);
  if (!tokenInfo || tokenInfo.expiresAt < Date.now()) {
    subscription.status = SUBSCRIPTION_STATUS.VERIFICATION_FAILED;
    subscription.updatedAt = new Date().toISOString();
    subscription.statusHistory.push({
      status: SUBSCRIPTION_STATUS.VERIFICATION_FAILED,
      time: new Date().toISOString(),
      reason: '回调验证失败：token已过期'
    });
    subscriptions.set(key, subscription);
    
    return {
      success: false,
      errorCode: 'VERIFICATION_FAILED',
      message: '回调验证失败：token已过期',
      subscription
    };
  }
  
  subscription.status = SUBSCRIPTION_STATUS.ENABLED;
  subscription.updatedAt = new Date().toISOString();
  subscription.statusHistory.push({
    status: SUBSCRIPTION_STATUS.ENABLED,
    time: new Date().toISOString(),
    reason: '回调验证成功'
  });
  subscriptions.set(key, subscription);
  verificationTokens.delete(token);
  
  const statsKey = subscription.subscriptionId;
  deliveryStats.set(statsKey, {
    subscriptionId: subscription.subscriptionId,
    customerId,
    eventId,
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    pausedDeliveriesSkipped: 0,
    lastDeliveryTime: null,
    deliveryHistory: []
  });
  
  return {
    success: true,
    status: SUBSCRIPTION_STATUS.ENABLED,
    message: '回调验证成功，订阅已启用',
    subscription
  };
}

function pauseSubscription(customerId, eventId, reason = '手动暂停') {
  const key = `${customerId}:${eventId}`;
  const subscription = subscriptions.get(key);
  
  if (!subscription) {
    return {
      success: false,
      errorCode: 'SUBSCRIPTION_NOT_FOUND',
      message: `未找到客户 ${customerId} 对事件 ${eventId} 的订阅`
    };
  }
  
  if (subscription.status !== SUBSCRIPTION_STATUS.ENABLED) {
    return {
      success: false,
      errorCode: 'INVALID_STATUS',
      message: `当前订阅状态(${subscription.status})不允许暂停操作，仅启用状态可暂停`,
      currentStatus: subscription.status
    };
  }
  
  subscription.status = SUBSCRIPTION_STATUS.PAUSED;
  subscription.updatedAt = new Date().toISOString();
  subscription.pausedAt = new Date().toISOString();
  subscription.statusHistory.push({
    status: SUBSCRIPTION_STATUS.PAUSED,
    time: new Date().toISOString(),
    reason
  });
  subscriptions.set(key, subscription);
  
  return {
    success: true,
    status: SUBSCRIPTION_STATUS.PAUSED,
    message: '订阅已暂停，暂停期间将不再投递事件但保留历史记录',
    subscription
  };
}

function resumeSubscription(customerId, eventId, reason = '手动恢复') {
  const key = `${customerId}:${eventId}`;
  const subscription = subscriptions.get(key);
  
  if (!subscription) {
    return {
      success: false,
      errorCode: 'SUBSCRIPTION_NOT_FOUND',
      message: `未找到客户 ${customerId} 对事件 ${eventId} 的订阅`
    };
  }
  
  if (subscription.status !== SUBSCRIPTION_STATUS.PAUSED) {
    return {
      success: false,
      errorCode: 'INVALID_STATUS',
      message: `当前订阅状态(${subscription.status})不允许恢复操作，仅暂停状态可恢复`,
      currentStatus: subscription.status
    };
  }
  
  subscription.status = SUBSCRIPTION_STATUS.ENABLED;
  subscription.updatedAt = new Date().toISOString();
  subscription.resumedAt = new Date().toISOString();
  subscription.statusHistory.push({
    status: SUBSCRIPTION_STATUS.ENABLED,
    time: new Date().toISOString(),
    reason
  });
  subscriptions.set(key, subscription);
  
  return {
    success: true,
    status: SUBSCRIPTION_STATUS.ENABLED,
    message: '订阅已恢复，将继续投递新事件（暂停期间的事件不会补发）',
    subscription
  };
}

function getSubscription(customerId, eventId) {
  const key = `${customerId}:${eventId}`;
  return subscriptions.get(key);
}

function getCustomerSubscriptions(customerId) {
  const results = [];
  for (const [key, sub] of subscriptions.entries()) {
    if (sub.customerId === customerId) {
      results.push(sub);
    }
  }
  return results;
}

function getAllSubscriptions() {
  const results = [];
  for (const [key, sub] of subscriptions.entries()) {
    results.push(sub);
  }
  return results;
}

function getActiveSubscriptions() {
  const results = [];
  for (const [key, sub] of subscriptions.entries()) {
    if (sub.status === SUBSCRIPTION_STATUS.ENABLED) {
      results.push(sub);
    }
  }
  return results;
}

function recordDelivery(subscriptionId, success, tenantId, eventData) {
  const stats = deliveryStats.get(subscriptionId);
  if (!stats) return null;
  
  const deliveryRecord = {
    deliveryId: `del_${Date.now()}`,
    time: new Date().toISOString(),
    success,
    tenantId,
    eventData
  };
  
  stats.totalDeliveries++;
  if (success) {
    stats.successfulDeliveries++;
  } else {
    stats.failedDeliveries++;
  }
  stats.lastDeliveryTime = new Date().toISOString();
  stats.deliveryHistory.push(deliveryRecord);
  
  deliveryStats.set(subscriptionId, stats);
  return deliveryRecord;
}

function recordPausedSkip(subscriptionId) {
  const stats = deliveryStats.get(subscriptionId);
  if (!stats) return null;
  
  stats.pausedDeliveriesSkipped++;
  deliveryStats.set(subscriptionId, stats);
  return stats;
}

function getDeliveryStats(subscriptionId) {
  return deliveryStats.get(subscriptionId);
}

function getCustomerDeliveryStats(customerId) {
  const results = [];
  for (const [key, stats] of deliveryStats.entries()) {
    if (stats.customerId === customerId) {
      results.push(stats);
    }
  }
  return results;
}

function explainSubscriptionFailure(customerId, eventId) {
  const key = `${customerId}:${eventId}`;
  const subscription = subscriptions.get(key);
  
  const reasons = [];
  const details = {};
  
  const eventPerm = checkEventPermission(customerId, eventId);
  if (!eventPerm.allowed) {
    reasons.push(eventPerm.reason);
    details.eventPermission = eventPerm;
  }
  
  const customer = getCustomerInfo(customerId);
  if (subscription) {
    const tenantCheck = checkTenantScope(customerId, subscription.tenants);
    if (!tenantCheck.allowed) {
      reasons.push(tenantCheck.reason);
      details.tenantScope = tenantCheck;
    }
    
    details.status = subscription.status;
    details.statusHistory = subscription.statusHistory;
    
    if (subscription.status === SUBSCRIPTION_STATUS.VERIFICATION_FAILED) {
      reasons.push('回调验证失败，请检查回调地址是否能正确返回验证token');
    }
  }
  
  return {
    customerId,
    eventId,
    eventInfo: getEventInfo(eventId),
    customerInfo: customer,
    hasActiveSubscription: subscription && subscription.status === SUBSCRIPTION_STATUS.ENABLED,
    subscription,
    failureReasons: reasons,
    details
  };
}

function getEventDirectory(customerId) {
  const customer = getCustomerInfo(customerId);
  if (!customer) {
    return { customerId, events: [], message: '客户不存在' };
  }
  
  const events = EVENT_DIRECTORY.map(event => {
    const hasPermission = event.allowedPlans.includes(customer.plan);
    const key = `${customerId}:${event.eventId}`;
    const subscription = subscriptions.get(key);
    
    return {
      ...event,
      availableForCustomer: hasPermission,
      subscription: subscription ? {
        subscriptionId: subscription.subscriptionId,
        status: subscription.status,
        tenants: subscription.tenants,
        callbackUrl: subscription.callbackUrl
      } : null
    };
  });
  
  const activeEvents = events.filter(e => e.subscription && e.subscription.status === SUBSCRIPTION_STATUS.ENABLED);
  
  return {
    customerId,
    customerPlan: customer.plan,
    allowedTenants: customer.allowedTenants,
    allEvents: events,
    activelyDeliveringEvents: activeEvents.map(e => ({
      eventId: e.eventId,
      eventName: e.name,
      subscriptionId: e.subscription.subscriptionId,
      callbackUrl: e.subscription.callbackUrl,
      tenants: e.subscription.tenants
    }))
  };
}

module.exports = {
  generateToken,
  getEventInfo,
  getCustomerInfo,
  checkEventPermission,
  checkTenantScope,
  checkDuplicateSubscription,
  createSubscription,
  verifySubscription,
  pauseSubscription,
  resumeSubscription,
  getSubscription,
  getCustomerSubscriptions,
  getAllSubscriptions,
  getActiveSubscriptions,
  recordDelivery,
  recordPausedSkip,
  getDeliveryStats,
  getCustomerDeliveryStats,
  explainSubscriptionFailure,
  getEventDirectory,
  SUBSCRIPTION_STATUS
};

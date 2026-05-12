import db from '../database.js';
import { randomUUID } from 'crypto';
import {
  addDays, addHours, addMinutes, isAfter, isBefore, differenceInMinutes,
  startOfMinute, endOfMinute, startOfHour, endOfHour, format, parseISO,
  isEqual, subDays, subHours
} from 'date-fns';

const SUBSCRIPTION_TYPES = {
  TRIAL: 'trial',
  PAID: 'paid',
  PROMOTION: 'promotion',
  UPGRADE: 'upgrade',
  DOWNGRADE: 'downgrade',
  TEMP_BOOST: 'temp_boost'
};

const SUBSCRIPTION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  SUPERSEDED: 'superseded'
};

const WINDOW_TYPES = {
  MINUTE: 'minute',
  HOUR: 'hour',
  DAY: 'day'
};

function generateId() {
  return randomUUID();
}

function safeParseDate(date) {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === 'string') return parseISO(date);
  return new Date(date);
}

function getWindowBounds(timestamp, windowType) {
  const date = new Date(timestamp);
  switch (windowType) {
    case WINDOW_TYPES.HOUR:
      return { start: startOfHour(date), end: endOfHour(date) };
    case WINDOW_TYPES.DAY:
      return { start: new Date(date.setHours(0, 0, 0, 0)), end: new Date(date.setHours(23, 59, 59, 999)) };
    case WINDOW_TYPES.MINUTE:
    default:
      return { start: startOfMinute(date), end: endOfMinute(date) };
  }
}

function isSubscriptionActive(sub, now = new Date()) {
  if (sub.status !== SUBSCRIPTION_STATUS.ACTIVE) return false;
  const start = safeParseDate(sub.start_date);
  if (start && isBefore(now, start)) return false;
  if (sub.end_date) {
    const end = safeParseDate(sub.end_date);
    if (end && isAfter(now, end)) return false;
  }
  return true;
}

export function getCurrentActiveSubscription(customerId, now = new Date()) {
  const subs = db.prepare('subscriptions')
    .where(s => s.customer_id === customerId)
    .all();

  const plansMap = {};
  db.prepare('plans').all().forEach(p => { plansMap[p.id] = p; });

  const withPlans = subs.map(s => ({
    ...s,
    plan_name: plansMap[s.plan_id]?.name,
    rate_limit: plansMap[s.plan_id]?.rate_limit,
    rate_window: plansMap[s.plan_id]?.rate_window,
    priority: plansMap[s.plan_id]?.priority,
    is_trial: plansMap[s.plan_id]?.is_trial,
    monthly_price: plansMap[s.plan_id]?.monthly_price,
    plan_description: plansMap[s.plan_id]?.description
  }));

  withPlans.sort((a, b) => {
    const typeOrder = { temp_boost: 0, paid: 1, upgrade: 1, trial: 2, downgrade: 3, promotion: 3 };
    const orderA = typeOrder[a.type] ?? 99;
    const orderB = typeOrder[b.type] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const activeSubs = withPlans.filter(sub => isSubscriptionActive(sub, now));
  
  const nonTrialBoost = activeSubs.find(s => 
    s.type === SUBSCRIPTION_TYPES.TEMP_BOOST || 
    s.type === SUBSCRIPTION_TYPES.PAID || 
    s.type === SUBSCRIPTION_TYPES.UPGRADE
  );
  if (nonTrialBoost) return nonTrialBoost;
  
  const trial = activeSubs.find(s => s.type === SUBSCRIPTION_TYPES.TRIAL);
  return trial || null;
}

export function getPendingDowngrade(customerId, now = new Date()) {
  const subs = db.prepare('subscriptions')
    .where(s => s.customer_id === customerId && 
                s.status === SUBSCRIPTION_STATUS.PENDING && 
                s.type === SUBSCRIPTION_TYPES.DOWNGRADE)
    .order('created_at', 'DESC')
    .limit(1)
    .all();

  if (subs.length === 0) return null;

  const sub = subs[0];
  const plan = db.prepare('plans').where(p => p.id === sub.plan_id).first();
  
  return {
    ...sub,
    plan_name: plan?.name,
    rate_limit: plan?.rate_limit,
    rate_window: plan?.rate_window,
    priority: plan?.priority,
    is_trial: plan?.is_trial,
    monthly_price: plan?.monthly_price
  };
}

export function getUsageInWindow(customerId, subscriptionId, windowStart, windowEnd) {
  const records = db.prepare('usage_records')
    .where(r => 
      r.customer_id === customerId && 
      r.request_timestamp >= windowStart.getTime() && 
      r.request_timestamp <= windowEnd.getTime() &&
      (!subscriptionId || r.subscription_id === subscriptionId)
    )
    .all();

  const count = records.length;
  const highPriorityCount = records.filter(r => r.priority === 1).length;
  const lowPriorityCount = count - highPriorityCount;

  return { count, high_priority_count: highPriorityCount, low_priority_count: lowPriorityCount };
}

export function getCurrentRateInfo(customerId, timestamp = Date.now()) {
  const now = new Date(timestamp);
  const currentSub = getCurrentActiveSubscription(customerId, now);
  const pendingDowngrade = getPendingDowngrade(customerId, now);
  
  if (!currentSub) {
    const window = getWindowBounds(now, 'minute');
    return {
      customerId,
      hasActiveSubscription: false,
      rateLimit: 0,
      rateWindow: 'minute',
      currentUsage: 0,
      remaining: 0,
      isExceeded: true,
      excessReason: 'NO_ACTIVE_SUBSCRIPTION',
      currentSubscription: null,
      pendingDowngrade: null,
      window: {
        start: window.start.toISOString(),
        end: window.end.toISOString()
      }
    };
  }

  const window = getWindowBounds(now, currentSub.rate_window);
  const usage = getUsageInWindow(customerId, currentSub.id, window.start, window.end);
  const currentUsage = usage.count || 0;
  const remaining = Math.max(0, currentSub.rate_limit - currentUsage);
  const isExceeded = currentUsage >= currentSub.rate_limit;
  
  let excessReason = null;
  if (isExceeded) {
    excessReason = 'RATE_LIMIT_EXCEEDED';
  } else if (currentSub.type === SUBSCRIPTION_TYPES.TRIAL && currentSub.end_date) {
    const endDate = safeParseDate(currentSub.end_date);
    if (endDate && differenceInMinutes(endDate, now) < 60) {
      excessReason = 'TRIAL_EXPIRING_SOON';
    }
  }

  return {
    customerId,
    hasActiveSubscription: true,
    rateLimit: currentSub.rate_limit,
    rateWindow: currentSub.rate_window,
    currentUsage,
    remaining,
    isExceeded,
    excessReason,
    currentSubscription: {
      id: currentSub.id,
      type: currentSub.type,
      planName: currentSub.plan_name,
      rateLimit: currentSub.rate_limit,
      rateWindow: currentSub.rate_window,
      startDate: currentSub.start_date,
      endDate: currentSub.end_date,
      isTrial: currentSub.is_trial === 1 || currentSub.is_trial === true
    },
    pendingDowngrade: pendingDowngrade ? {
      id: pendingDowngrade.id,
      planName: pendingDowngrade.plan_name,
      rateLimit: pendingDowngrade.rate_limit,
      effectiveAt: pendingDowngrade.effective_at
    } : null,
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString()
    }
  };
}

export function recordUsage(customerId, options = {}) {
  const {
    apiEndpoint = null,
    priority = 1,
    timestamp = Date.now(),
    operator = 'system'
  } = options;
  
  const now = new Date(timestamp);
  const currentSub = getCurrentActiveSubscription(customerId, now);
  
  if (!currentSub) {
    const usageId = generateId();
    db.insert('usage_records', {
      id: usageId,
      customer_id: customerId,
      api_endpoint: apiEndpoint,
      priority,
      request_time: now.toISOString(),
      request_timestamp: timestamp,
      is_exceeded: 1
    });
    
    return {
      allowed: false,
      reason: 'NO_ACTIVE_SUBSCRIPTION',
      rateInfo: getCurrentRateInfo(customerId, timestamp)
    };
  }

  const window = getWindowBounds(now, currentSub.rate_window);
  const usage = getUsageInWindow(customerId, currentSub.id, window.start, window.end);
  const currentUsage = usage.count || 0;
  const isExceeded = currentUsage >= currentSub.rate_limit;
  
  let allowed = true;
  let reason = null;
  
  if (isExceeded) {
    if (priority === 1) {
      allowed = false;
      reason = 'RATE_LIMIT_EXCEEDED_HIGH_PRIORITY';
    } else {
      reason = 'RATE_LIMIT_EXCEEDED_LOW_PRIORITY';
    }
  }

  const usageId = generateId();
  db.insert('usage_records', {
    id: usageId,
    customer_id: customerId,
    subscription_id: currentSub.id,
    api_endpoint: apiEndpoint,
    priority,
    request_time: now.toISOString(),
    request_timestamp: timestamp,
    is_exceeded: isExceeded ? 1 : 0
  });

  if (isExceeded && allowed) {
    checkAndRecordExcess(customerId, currentSub, window, currentUsage + 1, operator);
  } else if (currentUsage + 1 >= currentSub.rate_limit && allowed) {
    checkAndRecordExcess(customerId, currentSub, window, currentUsage + 1, operator);
  }

  return {
    allowed,
    reason,
    rateInfo: getCurrentRateInfo(customerId, timestamp)
  };
}

function checkAndRecordExcess(customerId, subscription, window, actualCount, operator) {
  const existing = db.prepare('excess_records')
    .where(e => 
      e.customer_id === customerId && 
      e.subscription_id === subscription.id && 
      e.window_start === window.start.toISOString()
    )
    .first();

  if (!existing && actualCount > subscription.rate_limit) {
    const excessCount = actualCount - subscription.rate_limit;
    const basePrice = subscription.monthly_price || 0;
    const perExcessCost = basePrice > 0 ? (basePrice / 1000) : 0.1;
    const billingImpact = excessCount * perExcessCost;

    const excessId = generateId();
    db.insert('excess_records', {
      id: excessId,
      customer_id: customerId,
      subscription_id: subscription.id,
      plan_id: subscription.plan_id,
      window_start: window.start.toISOString(),
      window_end: window.end.toISOString(),
      rate_limit: subscription.rate_limit,
      actual_count: actualCount,
      excess_count: excessCount,
      billing_impact: billingImpact
    });

    const auditId = generateId();
    db.insert('audit_logs', {
      id: auditId,
      customer_id: customerId,
      subscription_id: subscription.id,
      action: 'EXCESS_RECORDED',
      details: JSON.stringify({
        excessId,
        windowStart: window.start.toISOString(),
        excessCount,
        billingImpact
      }),
      operator
    });
  } else if (existing && actualCount > existing.actual_count) {
    const excessCount = actualCount - existing.rate_limit;
    const basePrice = existing.monthly_price || 0;
    const perExcessCost = basePrice > 0 ? (basePrice / 1000) : 0.1;
    const billingImpact = excessCount * perExcessCost;

    db.update('excess_records', r => r.id === existing.id, {
      actual_count: actualCount,
      excess_count: excessCount,
      billing_impact: billingImpact
    });
  }
}

export function createSubscription(customerId, planId, type, options = {}) {
  const {
    startDate = new Date(),
    endDate = null,
    effectiveAt = null,
    status = SUBSCRIPTION_STATUS.ACTIVE,
    sourceSubscriptionId = null,
    operator = 'system'
  } = options;

  const existingPlan = db.prepare('plans').where(p => p.id === planId).first();
  if (!existingPlan) {
    throw new Error('Plan not found');
  }

  const existingCustomer = db.prepare('customers').where(c => c.id === customerId).first();
  if (!existingCustomer) {
    throw new Error('Customer not found');
  }

  let actualEndDate = endDate;
  if (type === SUBSCRIPTION_TYPES.TRIAL && existingPlan.trial_days && !endDate) {
    actualEndDate = addDays(startDate, existingPlan.trial_days).toISOString();
  }

  const subId = generateId();
  const sub = db.insert('subscriptions', {
    id: subId,
    customer_id: customerId,
    plan_id: planId,
    type,
    status,
    start_date: startDate.toISOString(),
    end_date: actualEndDate,
    effective_at: effectiveAt ? effectiveAt.toISOString() : null,
    source_subscription_id: sourceSubscriptionId
  });

  const auditId = generateId();
  db.insert('audit_logs', {
    id: auditId,
    customer_id: customerId,
    subscription_id: subId,
    action: 'SUBSCRIPTION_CREATED',
    details: JSON.stringify({
      type,
      planName: existingPlan.name,
      rateLimit: existingPlan.rate_limit,
      startDate: startDate.toISOString(),
      endDate: actualEndDate
    }),
    operator
  });

  return getSubscriptionById(subId);
}

export function upgradeSubscription(customerId, newPlanId, operator = 'system') {
  const now = new Date();
  const currentSub = getCurrentActiveSubscription(customerId, now);
  
  if (!currentSub) {
    throw new Error('No active subscription to upgrade');
  }

  if (currentSub.plan_id === newPlanId) {
    throw new Error('Already on this plan');
  }

  const newPlan = db.prepare('plans').where(p => p.id === newPlanId).first();
  if (!newPlan) {
    throw new Error('Plan not found');
  }

  const pending = db.prepare('subscriptions')
    .where(s => 
      s.customer_id === customerId && 
      s.status === SUBSCRIPTION_STATUS.PENDING && 
      ['upgrade', 'downgrade', 'temp_boost'].includes(s.type)
    )
    .all();

  pending.forEach(p => {
    db.update('subscriptions', s => s.id === p.id, {
      status: SUBSCRIPTION_STATUS.SUPERSEDED
    });

    const auditId = generateId();
    db.insert('audit_logs', {
      id: auditId,
      customer_id: customerId,
      subscription_id: p.id,
      action: 'SUBSCRIPTION_SUPERSEDED',
      details: JSON.stringify({
        reason: 'UPGRADE_REQUESTED',
        newPlan: newPlan.name
      }),
      operator
    });
  });

  db.update('subscriptions', s => s.id === currentSub.id, {
    status: SUBSCRIPTION_STATUS.SUPERSEDED,
    end_date: now.toISOString()
  });

  const auditId2 = generateId();
  db.insert('audit_logs', {
    id: auditId2,
    customer_id: customerId,
    subscription_id: currentSub.id,
    action: 'SUBSCRIPTION_SUPERSEDED',
    details: JSON.stringify({
      reason: 'UPGRADE',
      newPlan: newPlan.name
    }),
    operator
  });

  return createSubscription(customerId, newPlanId, SUBSCRIPTION_TYPES.UPGRADE, {
    startDate: now,
    sourceSubscriptionId: currentSub.id,
    operator
  });
}

export function downgradeSubscription(customerId, newPlanId, effectiveAt = null, operator = 'system') {
  const now = new Date();
  const currentSub = getCurrentActiveSubscription(customerId, now);
  
  if (!currentSub) {
    throw new Error('No active subscription to downgrade');
  }

  if (currentSub.plan_id === newPlanId) {
    throw new Error('Already on this plan');
  }

  const newPlan = db.prepare('plans').where(p => p.id === newPlanId).first();
  if (!newPlan) {
    throw new Error('Plan not found');
  }

  const existingPending = db.prepare('subscriptions')
    .where(s => 
      s.customer_id === customerId && 
      s.status === SUBSCRIPTION_STATUS.PENDING && 
      s.type === SUBSCRIPTION_TYPES.DOWNGRADE
    )
    .first();

  if (existingPending) {
    throw new Error('A downgrade is already pending');
  }

  const actualEffectiveAt = effectiveAt || addHours(now, 1);

  return createSubscription(customerId, newPlanId, SUBSCRIPTION_TYPES.DOWNGRADE, {
    startDate: actualEffectiveAt,
    effectiveAt: actualEffectiveAt,
    status: SUBSCRIPTION_STATUS.PENDING,
    sourceSubscriptionId: currentSub.id,
    operator
  });
}

export function addTemporaryBoost(customerId, boostAmount, durationHours, operator = 'system') {
  const now = new Date();
  const currentSub = getCurrentActiveSubscription(customerId, now);
  
  if (!currentSub) {
    throw new Error('No active subscription to boost');
  }

  const endDate = addHours(now, durationHours);
  const newRate = currentSub.rate_limit + boostAmount;

  const tempPlanId = generateId();
  db.insert('plans', {
    id: tempPlanId,
    name: `临时加量 ${currentSub.plan_name} +${boostAmount}`,
    rate_limit: newRate,
    rate_window: currentSub.rate_window,
    priority: currentSub.priority,
    description: `Temporary boost for ${durationHours} hours`,
    is_trial: 0,
    trial_days: 0,
    monthly_price: 0,
    status: 'active'
  });

  db.update('subscriptions', s => s.id === currentSub.id, {
    status: SUBSCRIPTION_STATUS.SUPERSEDED,
    end_date: now.toISOString()
  });

  const boostSub = createSubscription(customerId, tempPlanId, SUBSCRIPTION_TYPES.TEMP_BOOST, {
    startDate: now,
    endDate: endDate,
    sourceSubscriptionId: currentSub.id,
    operator
  });

  const restorePlanId = currentSub.plan_id;
  db.insert('subscriptions', {
    id: generateId(),
    customer_id: customerId,
    plan_id: restorePlanId,
    type: SUBSCRIPTION_TYPES.PAID,
    status: SUBSCRIPTION_STATUS.PENDING,
    start_date: endDate.toISOString(),
    end_date: currentSub.end_date,
    effective_at: endDate.toISOString(),
    source_subscription_id: boostSub.id
  });

  return boostSub;
}

export function getSubscriptionTimeline(customerId) {
  const subs = db.prepare('subscriptions')
    .where(s => s.customer_id === customerId)
    .order('start_date', 'ASC')
    .all();

  const plansMap = {};
  db.prepare('plans').all().forEach(p => { plansMap[p.id] = p; });

  const now = new Date();
  return subs.map(sub => {
    const plan = plansMap[sub.plan_id];
    let timelineStatus = 'past';
    const start = safeParseDate(sub.start_date);
    const end = sub.end_date ? safeParseDate(sub.end_date) : null;

    if (sub.status === SUBSCRIPTION_STATUS.PENDING) {
      timelineStatus = 'pending';
    } else if (isBefore(now, start)) {
      timelineStatus = 'future';
    } else if (!end || isBefore(now, end)) {
      if (sub.status === SUBSCRIPTION_STATUS.ACTIVE) {
        timelineStatus = 'active';
      } else if (sub.status === SUBSCRIPTION_STATUS.SUPERSEDED) {
        timelineStatus = 'superseded';
      }
    }

    return {
      id: sub.id,
      type: sub.type,
      planName: plan?.name,
      rateLimit: plan?.rate_limit,
      rateWindow: plan?.rate_window,
      startDate: sub.start_date,
      endDate: sub.end_date,
      status: sub.status,
      timelineStatus,
      isTrial: plan?.is_trial === 1 || plan?.is_trial === true,
      isBoost: sub.type === SUBSCRIPTION_TYPES.TEMP_BOOST,
      isUpgrade: sub.type === SUBSCRIPTION_TYPES.UPGRADE,
      isDowngrade: sub.type === SUBSCRIPTION_TYPES.DOWNGRADE
    };
  });
}

export function estimateBilling(customerId, fromDate = null, toDate = null) {
  const now = new Date();
  const start = fromDate || subDays(now, 30);
  const end = toDate || now;

  const subs = db.prepare('subscriptions')
    .where(s => 
      s.customer_id === customerId && 
      new Date(s.created_at) >= start && 
      new Date(s.created_at) <= end
    )
    .order('created_at', 'ASC')
    .all();

  const plansMap = {};
  db.prepare('plans').all().forEach(p => { plansMap[p.id] = p; });

  const withPlans = subs.map(s => ({
    ...s,
    plan_name: plansMap[s.plan_id]?.name,
    monthly_price: plansMap[s.plan_id]?.monthly_price,
    rate_limit: plansMap[s.plan_id]?.rate_limit
  }));

  const excess = db.prepare('excess_records')
    .where(e => 
      e.customer_id === customerId && 
      new Date(e.window_start) >= start && 
      new Date(e.window_end) <= end
    )
    .all();

  const usage = db.prepare('usage_records')
    .where(r => 
      r.customer_id === customerId && 
      r.request_timestamp >= start.getTime() && 
      r.request_timestamp <= end.getTime()
    )
    .all();

  const totalExcess = excess.reduce((sum, e) => sum + (e.excess_count || 0), 0);
  const totalExcessCost = excess.reduce((sum, e) => sum + (e.billing_impact || 0), 0);
  const excessWindows = excess.length;

  const totalRequests = usage.length;
  const exceededRequests = usage.filter(r => r.is_exceeded === 1).length;

  let subscriptionCost = 0;
  const breakdown = [];

  withPlans.forEach(sub => {
    const subStart = safeParseDate(sub.start_date);
    const subEnd = sub.end_date ? safeParseDate(sub.end_date) : now;
    const effectiveStart = subStart > start ? subStart : start;
    const effectiveEnd = subEnd < end ? subEnd : end;

    if (effectiveStart < effectiveEnd) {
      const daysInPeriod = Math.max(1, Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)));
      const dailyRate = (sub.monthly_price || 0) / 30;
      const cost = dailyRate * daysInPeriod;
      
      subscriptionCost += cost;
      breakdown.push({
        subscriptionId: sub.id,
        planName: sub.plan_name,
        type: sub.type,
        startDate: effectiveStart.toISOString(),
        endDate: effectiveEnd.toISOString(),
        days: daysInPeriod,
        cost
      });
    }
  });

  const totalCost = subscriptionCost + totalExcessCost;

  return {
    customerId,
    period: { start: start.toISOString(), end: end.toISOString() },
    subscriptionCost: Math.round(subscriptionCost * 100) / 100,
    excessCost: Math.round(totalExcessCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    usage: {
      totalRequests,
      exceededRequests,
      excessWindows,
      totalExcessRequests: totalExcess
    },
    breakdown
  };
}

export function getSubscriptionById(id) {
  const sub = db.prepare('subscriptions').where(s => s.id === id).first();
  if (!sub) return null;

  const plan = db.prepare('plans').where(p => p.id === sub.plan_id).first();
  return {
    ...sub,
    plan_name: plan?.name,
    rate_limit: plan?.rate_limit,
    rate_window: plan?.rate_window,
    priority: plan?.priority,
    is_trial: plan?.is_trial,
    monthly_price: plan?.monthly_price
  };
}

export function getExcessRecords(customerId, limit = 50) {
  const records = db.prepare('excess_records')
    .where(e => e.customer_id === customerId)
    .order('window_start', 'DESC')
    .limit(limit)
    .all();

  const plansMap = {};
  db.prepare('plans').all().forEach(p => { plansMap[p.id] = p; });

  return records.map(r => ({
    ...r,
    plan_name: plansMap[r.plan_id]?.name
  }));
}

export function processPendingSubscriptions(now = new Date()) {
  const pending = db.prepare('subscriptions')
    .where(s => s.status === SUBSCRIPTION_STATUS.PENDING)
    .all();

  const activated = [];
  pending.forEach(sub => {
    const effectiveAt = sub.effective_at ? safeParseDate(sub.effective_at) : safeParseDate(sub.start_date);
    if (effectiveAt && (isAfter(now, effectiveAt) || isEqual(now, effectiveAt))) {
      const currentSub = getCurrentActiveSubscription(sub.customer_id, now);
      if (currentSub && currentSub.id !== sub.id) {
        db.update('subscriptions', s => s.id === currentSub.id, {
          status: SUBSCRIPTION_STATUS.SUPERSEDED,
          end_date: now.toISOString()
        });
      }

      db.update('subscriptions', s => s.id === sub.id, {
        status: SUBSCRIPTION_STATUS.ACTIVE
      });

      activated.push(sub.id);
    }
  });

  return activated;
}

export function expireSubscriptions(now = new Date()) {
  const active = db.prepare('subscriptions')
    .where(s => s.status === SUBSCRIPTION_STATUS.ACTIVE && s.end_date !== null)
    .all();

  const expired = [];
  active.forEach(sub => {
    const endDate = safeParseDate(sub.end_date);
    if (endDate && isAfter(now, endDate)) {
      db.update('subscriptions', s => s.id === sub.id, {
        status: SUBSCRIPTION_STATUS.EXPIRED
      });

      expired.push(sub.id);
    }
  });

  return expired;
}

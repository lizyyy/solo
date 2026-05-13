const { getAllSubscriptions, getSubscription, recordDelivery, recordPausedSkip, SUBSCRIPTION_STATUS } = require('./subscriptionService');

function simulateEventTrigger(eventId, tenantId, eventData) {
  const allSubs = getAllSubscriptions();
  const targetSubs = allSubs.filter(sub => 
    sub.eventId === eventId && 
    sub.tenants.includes(tenantId)
  );
  
  const results = [];
  
  for (const sub of targetSubs) {
    if (sub.status === SUBSCRIPTION_STATUS.ENABLED) {
      const success = Math.random() > 0.1;
      const delivery = recordDelivery(sub.subscriptionId, success, tenantId, eventData);
      results.push({
        subscriptionId: sub.subscriptionId,
        customerId: sub.customerId,
        eventId,
        tenantId,
        callbackUrl: sub.callbackUrl,
        status: success ? 'delivered' : 'failed',
        delivery
      });
    }
  }
  
  return results;
}

function simulateEventTriggerWithPaused(eventId, tenantId, eventData) {
  const allSubs = getAllSubscriptions();
  const targetSubs = allSubs.filter(sub => 
    sub.eventId === eventId && 
    sub.tenants.includes(tenantId)
  );
  
  const results = [];
  
  for (const sub of targetSubs) {
    if (sub.status === SUBSCRIPTION_STATUS.ENABLED) {
      const success = Math.random() > 0.1;
      const delivery = recordDelivery(sub.subscriptionId, success, tenantId, eventData);
      results.push({
        subscriptionId: sub.subscriptionId,
        customerId: sub.customerId,
        eventId,
        tenantId,
        callbackUrl: sub.callbackUrl,
        status: success ? 'delivered' : 'failed',
        delivery
      });
    } else if (sub.status === SUBSCRIPTION_STATUS.PAUSED) {
      recordPausedSkip(sub.subscriptionId);
      results.push({
        subscriptionId: sub.subscriptionId,
        customerId: sub.customerId,
        eventId,
        tenantId,
        callbackUrl: sub.callbackUrl,
        status: 'skipped_paused',
        message: '订阅已暂停，跳过投递（计入暂停跳过统计）'
      });
    }
  }
  
  return results;
}

module.exports = {
  simulateEventTrigger,
  simulateEventTriggerWithPaused
};

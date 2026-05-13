const memoryDb = require('../database-memory');

const BOUNCE_TYPES = {
  HARD: 'hard_bounce',
  SOFT: 'soft_bounce',
  MAILBOX_FULL: 'mailbox_full',
  DOMAIN_UNREACHABLE: 'domain_unreachable',
  UNSUBSCRIBE: 'unsubscribe'
};

const ADDRESS_STATUSES = {
  ACTIVE: 'active',
  SOFT_BOUNCE: 'soft_bounce',
  SUSPENDED: 'suspended',
  HARD_BOUNCE: 'hard_bounce',
  UNSUBSCRIBED: 'unsubscribed'
};

const SOFT_BOUNCE_THRESHOLD = 3;

function getDomain(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : 'unknown';
}

function classifyBounce(rawType, rawReason) {
  if (!rawType && !rawReason) return BOUNCE_TYPES.SOFT;

  const type = (rawType || '').toLowerCase();
  const reason = (rawReason || '').toLowerCase();

  if (type.includes('unsubscribe') || reason.includes('unsubscribe') || 
      type.includes('complaint') || reason.includes('opt-out')) {
    return BOUNCE_TYPES.UNSUBSCRIBE;
  }

  if (type.includes('hard') || 
      reason.includes('user unknown') || 
      reason.includes('no such user') ||
      reason.includes('does not exist') ||
      reason.includes('address not found') ||
      reason.includes('recipient rejected') ||
      reason.includes('550 5.1.1') ||
      reason.includes('550 5.1.0')) {
    return BOUNCE_TYPES.HARD;
  }

  if (reason.includes('mailbox full') || 
      reason.includes('quota exceeded') ||
      reason.includes('storage limit') ||
      reason.includes('over quota')) {
    return BOUNCE_TYPES.MAILBOX_FULL;
  }

  if (reason.includes('domain not found') ||
      reason.includes('dns') ||
      reason.includes('host not found') ||
      reason.includes('connection timed out') ||
      reason.includes('unreachable')) {
    return BOUNCE_TYPES.DOMAIN_UNREACHABLE;
  }

  if (type.includes('soft') ||
      reason.includes('temporary') ||
      reason.includes('greylisted') ||
      reason.includes('try again later') ||
      reason.includes('deferred')) {
    return BOUNCE_TYPES.SOFT;
  }

  return BOUNCE_TYPES.SOFT;
}

function getOrCreateAddressStatus(email) {
  const now = Date.now();
  const domain = getDomain(email);
  
  let status = memoryDb.addressStatus.get(email);
  
  if (!status) {
    status = {
      email,
      domain,
      status: ADDRESS_STATUSES.ACTIVE,
      soft_bounce_count: 0,
      last_bounce_type: null,
      last_bounce_reason: null,
      last_bounce_at: null,
      can_send_marketing: 1,
      can_send_billing: 1,
      updated_at: now,
      created_at: now
    };
    memoryDb.addressStatus.set(email, status);
  }
  
  return status;
}

function updateAddressStatusForBounce(email, bounceType, bounceReason) {
  const now = Date.now();
  const status = getOrCreateAddressStatus(email);
  
  let newStatus = status.status;
  let newSoftCount = status.soft_bounce_count;
  let canSendMarketing = status.can_send_marketing;
  let canSendBilling = status.can_send_billing;

  switch (bounceType) {
    case BOUNCE_TYPES.HARD:
      newStatus = ADDRESS_STATUSES.HARD_BOUNCE;
      canSendMarketing = 0;
      newSoftCount = 0;
      break;

    case BOUNCE_TYPES.UNSUBSCRIBE:
      newStatus = ADDRESS_STATUSES.UNSUBSCRIBED;
      canSendMarketing = 0;
      newSoftCount = 0;
      break;

    case BOUNCE_TYPES.MAILBOX_FULL:
    case BOUNCE_TYPES.DOMAIN_UNREACHABLE:
    case BOUNCE_TYPES.SOFT:
      newSoftCount = status.soft_bounce_count + 1;
      if (newSoftCount >= SOFT_BOUNCE_THRESHOLD) {
        newStatus = ADDRESS_STATUSES.SUSPENDED;
        canSendMarketing = 0;
      } else {
        newStatus = ADDRESS_STATUSES.SOFT_BOUNCE;
      }
      break;
  }

  const updated = {
    ...status,
    status: newStatus,
    soft_bounce_count: newSoftCount,
    last_bounce_type: bounceType,
    last_bounce_reason: bounceReason,
    last_bounce_at: now,
    can_send_marketing: canSendMarketing,
    can_send_billing: canSendBilling,
    updated_at: now
  };

  memoryDb.addressStatus.set(email, updated);

  return updated;
}

function processBounceEvent(event) {
  const existing = memoryDb.bounceEvents.get(event.id);
  if (existing) {
    return {
      processed: false,
      duplicate: true,
      event: existing
    };
  }

  const now = Date.now();
  const bounceType = classifyBounce(event.type, event.reason);

  const bounceRecord = {
    id: event.id,
    email: event.email,
    bounce_type: bounceType,
    bounce_reason: event.reason || null,
    business_type: event.business_type || null,
    message_id: event.message_id || null,
    received_at: event.received_at || now,
    processed_at: now
  };

  memoryDb.bounceEvents.set(event.id, bounceRecord);

  const addressStatus = updateAddressStatusForBounce(event.email, bounceType, event.reason || null);

  return {
    processed: true,
    duplicate: false,
    bounceType,
    addressStatus
  };
}

function createSendRecord(send) {
  const now = Date.now();
  const domain = getDomain(send.email);
  
  getOrCreateAddressStatus(send.email);

  const record = {
    id: send.id,
    email: send.email,
    domain,
    business_type: send.business_type,
    subject: send.subject || null,
    status: 'pending',
    sent_at: now,
    message_id: send.message_id || send.id
  };

  memoryDb.emailSends.set(send.id, record);

  return record;
}

function canSend(email, businessType) {
  const status = memoryDb.addressStatus.get(email);
  
  if (!status) {
    return {
      canSend: true,
      reason: 'address_not_tracked',
      status: null
    };
  }

  const isMarketing = businessType === 'marketing';
  const isBilling = businessType === 'billing';

  if (status.status === ADDRESS_STATUSES.UNSUBSCRIBED && isMarketing) {
    return {
      canSend: false,
      reason: 'user_unsubscribed',
      status: status.status
    };
  }

  if (status.status === ADDRESS_STATUSES.HARD_BOUNCE && isMarketing) {
    return {
      canSend: false,
      reason: 'hard_bounce',
      status: status.status
    };
  }

  if (status.status === ADDRESS_STATUSES.SUSPENDED && isMarketing) {
    return {
      canSend: false,
      reason: 'soft_bounce_threshold_exceeded',
      status: status.status,
      softBounceCount: status.soft_bounce_count
    };
  }

  if (status.status === ADDRESS_STATUSES.SOFT_BOUNCE && isMarketing) {
    return {
      canSend: true,
      reason: 'soft_bounce_within_limit',
      status: status.status,
      softBounceCount: status.soft_bounce_count,
      remainingRetries: SOFT_BOUNCE_THRESHOLD - status.soft_bounce_count
    };
  }

  if (status.status === ADDRESS_STATUSES.HARD_BOUNCE && isBilling) {
    return {
      canSend: true,
      reason: 'billing_requires_manual_confirmation',
      status: status.status,
      requiresManualReview: true
    };
  }

  return {
    canSend: true,
    reason: 'address_active',
    status: status.status
  };
}

function getAddressStatus(email) {
  const status = memoryDb.addressStatus.get(email);
  
  if (!status) {
    return null;
  }

  return {
    email: status.email,
    domain: status.domain,
    status: status.status,
    softBounceCount: status.soft_bounce_count,
    lastBounceType: status.last_bounce_type,
    lastBounceReason: status.last_bounce_reason,
    lastBounceAt: status.last_bounce_at,
    canSendMarketing: !!status.can_send_marketing,
    canSendBilling: !!status.can_send_billing,
    allowedSendTypes: {
      marketing: !!status.can_send_marketing,
      billing: !!status.can_send_billing
    },
    updatedAt: status.updated_at,
    createdAt: status.created_at
  };
}

function getDeliveryQualityReport(options = {}) {
  const { startDate, endDate, domain, businessType } = options;
  
  const byDomain = new Map();
  const byBusinessType = new Map();
  const byBounceType = new Map();
  let totalSends = 0;
  let totalBounces = 0;

  for (const send of memoryDb.emailSends.values()) {
    if (startDate && send.sent_at < startDate) continue;
    if (endDate && send.sent_at > endDate) continue;
    if (domain && send.domain !== domain) continue;
    if (businessType && send.business_type !== businessType) continue;

    totalSends++;

    if (!byDomain.has(send.domain)) {
      byDomain.set(send.domain, { total: 0, bounces: 0 });
    }
    byDomain.get(send.domain).total++;

    if (!byBusinessType.has(send.business_type)) {
      byBusinessType.set(send.business_type, { total: 0, bounces: 0 });
    }
    byBusinessType.get(send.business_type).total++;

    let hasBounce = false;
    for (const bounce of memoryDb.bounceEvents.values()) {
      if (bounce.message_id === send.message_id) {
        hasBounce = true;
        totalBounces++;
        byDomain.get(send.domain).bounces++;
        byBusinessType.get(send.business_type).bounces++;

        const bt = bounce.bounce_type;
        byBounceType.set(bt, (byBounceType.get(bt) || 0) + 1);
        break;
      }
    }
  }

  const domainStats = [];
  for (const [d, stats] of byDomain) {
    domainStats.push({
      domain: d,
      totalSends: stats.total,
      bounceCount: stats.bounces,
      bounceRate: stats.total > 0 
        ? (stats.bounces / stats.total * 100).toFixed(2) + '%'
        : '0%'
    });
  }
  domainStats.sort((a, b) => b.totalSends - a.totalSends);

  const businessTypeStats = [];
  for (const [bt, stats] of byBusinessType) {
    businessTypeStats.push({
      businessType: bt,
      totalSends: stats.total,
      bounceCount: stats.bounces,
      bounceRate: stats.total > 0 
        ? (stats.bounces / stats.total * 100).toFixed(2) + '%'
        : '0%'
    });
  }
  businessTypeStats.sort((a, b) => b.totalSends - a.totalSends);

  const bounceTypeStats = [];
  for (const [bt, count] of byBounceType) {
    bounceTypeStats.push({
      bounceType: bt,
      count
    });
  }
  bounceTypeStats.sort((a, b) => b.count - a.count);

  return {
    summary: {
      totalSends,
      totalBounces,
      bounceRate: totalSends > 0 
        ? (totalBounces / totalSends * 100).toFixed(2) + '%'
        : '0%'
    },
    byDomain: domainStats,
    byBusinessType: businessTypeStats,
    byBounceType: bounceTypeStats
  };
}

module.exports = {
  BOUNCE_TYPES,
  ADDRESS_STATUSES,
  SOFT_BOUNCE_THRESHOLD,
  classifyBounce,
  processBounceEvent,
  createSendRecord,
  canSend,
  getAddressStatus,
  getDeliveryQualityReport
};

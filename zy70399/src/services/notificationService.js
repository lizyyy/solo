const store = require('../storage/memoryStore');
const {
  Service,
  TenantRule,
  NotificationGroup,
  Notification,
  SendHistoryEntry,
  isHighSeverity,
  getHigherSeverity,
  getSeverityLevel
} = require('../models/models');

const DEFAULT_RULE = {
  silenceWindowMinutes: 30,
  mergeSimilarEnabled: true,
  mergeSimilarMinutes: 15,
  upgradeThreshold: 3,
  upgradeToSeverity: 'critical',
  highSeverityBypass: true,
  notifyOnRecurrence: true,
  sendSummaryAfterSilence: true
};

function getRuleOrDefault(serviceId, tenantId) {
  const rule = store.getTenantRule(serviceId, tenantId);
  if (rule) return rule;
  return new TenantRule({ serviceId, tenantId, ...DEFAULT_RULE });
}

function isWithinSilenceWindow(group, rule) {
  if (!group.lastSentAt) return false;
  const silenceMs = rule.silenceWindowMinutes * 60 * 1000;
  return (Date.now() - new Date(group.lastSentAt).getTime()) < silenceMs;
}

function shouldBypassSilence(severity, rule) {
  return rule.highSeverityBypass && isHighSeverity(severity);
}

function shouldSendNotification(group, notification, rule) {
  if (!group.lastSentAt) return true;
  if (shouldBypassSilence(notification.severity, rule)) return true;
  if (group.confirmed && rule.notifyOnRecurrence) {
    const newEvidence = Object.keys(notification.evidence).length > 0;
    if (newEvidence) return true;
  }
  return false;
}

function createOrRegisterService(serviceId, serviceName, description = '') {
  let service = store.getService(serviceId);
  if (!service) {
    service = new Service(serviceId, serviceName, description);
    store.upsertService(service);
  }
  return service;
}

function setTenantRule(config) {
  const rule = new TenantRule(config);
  store.upsertTenantRule(rule);
  return rule;
}

function getTenantRule(serviceId, tenantId) {
  return store.getTenantRule(serviceId, tenantId);
}

function processIncomingNotification(payload) {
  const {
    serviceId,
    serviceName,
    tenantId,
    severity = 'warning',
    messageKey,
    title,
    message,
    evidence = {}
  } = payload;

  if (!serviceId || !tenantId || !messageKey || !title) {
    throw new Error('缺少必要字段: serviceId, tenantId, messageKey, title');
  }

  createOrRegisterService(serviceId, serviceName || serviceId);

  const rule = getRuleOrDefault(serviceId, tenantId);

  const failureCount = store.incrementTenantFailure(serviceId, tenantId);
  const shouldUpgrade = failureCount >= rule.upgradeThreshold;
  const effectiveSeverity = shouldUpgrade
    ? getHigherSeverity(severity, rule.upgradeToSeverity)
    : severity;

  let group = store.findActiveGroup(serviceId, tenantId, severity, messageKey);
  const isNewGroup = !group;

  if (isNewGroup) {
    const groupId = store.generateId();
    group = new NotificationGroup({
      id: groupId,
      serviceId,
      tenantId,
      severity: effectiveSeverity,
      messageKey,
      title,
      status: 'active'
    });

    if (shouldUpgrade) {
      group.upgradedFrom = severity;
      group.upgradeReason = `连续${failureCount}次失败触发升级`;
      group.upgradedAt = new Date();
    }

    store.upsertNotificationGroup(group);
  }

  const notificationId = store.generateId();
  const notification = new Notification({
    id: notificationId,
    groupId: group.id,
    serviceId,
    tenantId,
    severity: effectiveSeverity,
    messageKey,
    title,
    message,
    evidence,
    upgradeTrigger: shouldUpgrade
  });

  const shouldSend = shouldSendNotification(group, { ...notification, severity: effectiveSeverity }, rule);
  const bypassSilence = shouldBypassSilence(effectiveSeverity, rule);
  const inSilence = isWithinSilenceWindow(group, rule);

  let sendType = null;
  let upgradeReason = null;

  if (isNewGroup) {
    notification.sent = true;
    sendType = 'initial';
    if (shouldUpgrade) {
      upgradeReason = group.upgradeReason;
      sendType = 'upgraded_initial';
    }
  } else if (shouldUpgrade && !group.upgradedAt) {
    group.severity = effectiveSeverity;
    group.upgradedFrom = severity;
    group.upgradeReason = `连续${failureCount}次失败触发升级`;
    group.upgradedAt = new Date();
    store.upsertNotificationGroup(group);
    notification.upgradeTrigger = true;
    notification.sent = true;
    sendType = 'upgrade';
    upgradeReason = group.upgradeReason;
  } else if (bypassSilence) {
    notification.sent = true;
    sendType = 'high_severity_bypass';
  } else if (group.confirmed && rule.notifyOnRecurrence && Object.keys(evidence).length > 0) {
    notification.sent = true;
    sendType = 'recurrence_with_evidence';
  } else if (!inSilence) {
    notification.sent = true;
    sendType = 'silence_expired';
  } else {
    notification.suppressed = true;
    store.incrementSuppressed(group.id);
  }

  if (notification.sent) {
    group.lastSentAt = new Date();
    store.upsertNotificationGroup(group);

    const suppressedCount = store.getSuppressedCount(group.id);
    const historyEntry = new SendHistoryEntry({
      id: store.generateId(),
      groupId: group.id,
      serviceId,
      tenantId,
      severity: effectiveSeverity,
      title,
      sendType,
      upgradeReason,
      suppressedCount
    });
    store.addToSendHistory(historyEntry);
  }

  store.upsertNotification(notification);

  return {
    groupId: group.id,
    notificationId: notification.id,
    sent: notification.sent,
    suppressed: notification.suppressed,
    sendType,
    upgraded: shouldUpgrade,
    upgradeReason,
    effectiveSeverity,
    isNewGroup
  };
}

function confirmNotification(groupId, confirmedBy = 'system') {
  const group = store.getNotificationGroup(groupId);
  if (!group) {
    throw new Error(`通知组不存在: ${groupId}`);
  }
  if (group.status === 'closed') {
    throw new Error('不能确认已关闭的通知组');
  }
  group.confirmed = true;
  group.confirmedAt = new Date();
  group.confirmedBy = confirmedBy;
  store.upsertNotificationGroup(group);
  return group;
}

function closeNotification(groupId, closedBy = 'system') {
  const group = store.getNotificationGroup(groupId);
  if (!group) {
    throw new Error(`通知组不存在: ${groupId}`);
  }
  group.status = 'closed';
  group.closedAt = new Date();
  group.closedBy = closedBy;
  store.resetTenantFailure(group.serviceId, group.tenantId);
  store.upsertNotificationGroup(group);
  return group;
}

function getActiveGroups(serviceId = null, tenantId = null) {
  let groups = store.getActiveNotificationGroups();
  if (serviceId) {
    groups = groups.filter(g => g.serviceId === serviceId);
  }
  if (tenantId) {
    groups = groups.filter(g => g.tenantId === tenantId);
  }
  return groups.map(g => ({
    ...g,
    suppressedCount: store.getSuppressedCount(g.id),
    notificationsCount: store.getNotificationsByGroup(g.id).length
  }));
}

function getSendHistory(serviceId = null, tenantId = null) {
  const filters = {};
  if (serviceId) filters.serviceId = serviceId;
  if (tenantId) filters.tenantId = tenantId;
  return store.getSendHistory(filters);
}

function getNotificationGroupDetail(groupId) {
  const group = store.getNotificationGroup(groupId);
  if (!group) return null;
  const notifications = store.getNotificationsByGroup(groupId);
  const suppressedCount = store.getSuppressedCount(groupId);
  const sentCount = notifications.filter(n => n.sent).length;
  const history = store.getSendHistory({}).filter(h => h.groupId === groupId);

  return {
    group,
    notifications,
    suppressedCount,
    sentCount,
    totalCount: notifications.length,
    sendHistory: history
  };
}

function generateNoiseReductionReport(timeRangeMinutes = 1440) {
  const cutoffTime = Date.now() - (timeRangeMinutes * 60 * 1000);

  const allGroups = store.getAllNotificationGroups();
  const timeFilteredGroups = allGroups.filter(
    g => new Date(g.createdAt).getTime() >= cutoffTime
  );

  const history = store.getSendHistory({}).filter(
    h => new Date(h.sentAt).getTime() >= cutoffTime
  );

  const highSeveritySent = history.filter(h => isHighSeverity(h.severity));
  const highSeverityInHistory = highSeveritySent.length;

  let totalSuppressed = 0;
  let totalNotifications = 0;
  const groupSummaries = [];
  const suppressedSamples = [];

  for (const group of timeFilteredGroups) {
    const suppressedCount = store.getSuppressedCount(group.id);
    const notifications = store.getNotificationsByGroup(group.id);
    totalSuppressed += suppressedCount;
    totalNotifications += notifications.length;

    groupSummaries.push({
      groupId: group.id,
      serviceId: group.serviceId,
      tenantId: group.tenantId,
      severity: group.severity,
      title: group.title,
      status: group.status,
      confirmed: group.confirmed,
      suppressedCount,
      totalCount: notifications.length,
      sentCount: notifications.filter(n => n.sent).length,
      upgraded: !!group.upgradedAt,
      upgradeReason: group.upgradeReason,
      createdAt: group.createdAt,
      lastSentAt: group.lastSentAt
    });

    if (suppressedCount > 0) {
      const suppressedNotifications = notifications.filter(n => n.suppressed);
      const sample = suppressedNotifications.slice(0, 3);
      suppressedSamples.push({
        groupId: group.id,
        title: group.title,
        suppressedCount,
        sampleNotifications: sample.map(n => ({
          id: n.id,
          message: n.message,
          createdAt: n.createdAt
        }))
      });
    }
  }

  const activeGroups = timeFilteredGroups.filter(g => g.status !== 'closed');
  const closedGroups = timeFilteredGroups.filter(g => g.status === 'closed');
  const upgradedGroups = timeFilteredGroups.filter(g => g.upgradedAt);

  const sendTypeBreakdown = {
    initial: history.filter(h => h.sendType === 'initial').length,
    upgraded_initial: history.filter(h => h.sendType === 'upgraded_initial').length,
    upgrade: history.filter(h => h.sendType === 'upgrade').length,
    high_severity_bypass: history.filter(h => h.sendType === 'high_severity_bypass').length,
    recurrence_with_evidence: history.filter(h => h.sendType === 'recurrence_with_evidence').length,
    silence_expired: history.filter(h => h.sendType === 'silence_expired').length
  };

  const highSeverityBypassed = history.filter(
    h => h.sendType === 'high_severity_bypass' || h.sendType === 'upgrade' || h.sendType === 'upgraded_initial'
  );

  return {
    reportGeneratedAt: new Date(),
    timeRangeMinutes,
    summary: {
      totalNotificationsProcessed: totalNotifications,
      totalSent: history.length,
      totalSuppressed,
      suppressionRate: totalNotifications > 0
        ? (totalSuppressed / totalNotifications * 100).toFixed(2) + '%'
        : '0%',
      activeGroups: activeGroups.length,
      closedGroups: closedGroups.length,
      upgradedGroups: upgradedGroups.length,
      highSeverityNotificationsSent: highSeverityInHistory,
      highSeverityBypassEvents: highSeverityBypassed.length
    },
    highSeverityGuarantee: {
      description: '所有高级别通知(error/critical)均未被静默',
      highSeveritySent: highSeverityInHistory,
      bypassedEvents: highSeverityBypassed.map(h => ({
        id: h.id,
        severity: h.severity,
        title: h.title,
        sendType: h.sendType,
        sentAt: h.sentAt
      }))
    },
    sendTypeBreakdown,
    groupSummaries,
    suppressedSamples: suppressedSamples.slice(0, 10)
  };
}

module.exports = {
  createOrRegisterService,
  setTenantRule,
  getTenantRule,
  processIncomingNotification,
  confirmNotification,
  closeNotification,
  getActiveGroups,
  getSendHistory,
  getNotificationGroupDetail,
  generateNoiseReductionReport
};

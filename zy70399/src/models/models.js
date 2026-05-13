const SEVERITY_ORDER = ['info', 'warning', 'error', 'critical'];

class Service {
  constructor(id, name, description = '') {
    this.id = id;
    this.name = name;
    this.description = description;
    this.createdAt = new Date();
  }
}

class TenantRule {
  constructor({
    serviceId,
    tenantId,
    silenceWindowMinutes = 30,
    mergeSimilarEnabled = true,
    mergeSimilarMinutes = 15,
    upgradeThreshold = 3,
    upgradeToSeverity = 'critical',
    highSeverityBypass = true,
    notifyOnRecurrence = true,
    sendSummaryAfterSilence = true
  }) {
    this.serviceId = serviceId;
    this.tenantId = tenantId;
    this.silenceWindowMinutes = silenceWindowMinutes;
    this.mergeSimilarEnabled = mergeSimilarEnabled;
    this.mergeSimilarMinutes = mergeSimilarMinutes;
    this.upgradeThreshold = upgradeThreshold;
    this.upgradeToSeverity = upgradeToSeverity;
    this.highSeverityBypass = highSeverityBypass;
    this.notifyOnRecurrence = notifyOnRecurrence;
    this.sendSummaryAfterSilence = sendSummaryAfterSilence;
    this.updatedAt = new Date();
  }
}

class NotificationGroup {
  constructor({
    id,
    serviceId,
    tenantId,
    severity,
    messageKey,
    title,
    status = 'active',
    confirmed = false,
    confirmedAt = null,
    confirmedBy = null,
    lastSentAt = null,
    upgradedFrom = null,
    upgradeReason = null,
    upgradedAt = null,
    createdAt = null
  }) {
    this.id = id;
    this.serviceId = serviceId;
    this.tenantId = tenantId;
    this.severity = severity;
    this.messageKey = messageKey;
    this.title = title;
    this.status = status;
    this.confirmed = confirmed;
    this.confirmedAt = confirmedAt;
    this.confirmedBy = confirmedBy;
    this.lastSentAt = lastSentAt;
    this.upgradedFrom = upgradedFrom;
    this.upgradeReason = upgradeReason;
    this.upgradedAt = upgradedAt;
    this.createdAt = createdAt || new Date();
  }
}

class Notification {
  constructor({
    id,
    groupId,
    serviceId,
    tenantId,
    severity,
    messageKey,
    title,
    message,
    evidence = {},
    suppressed = false,
    sent = false,
    upgradeTrigger = false,
    createdAt = null
  }) {
    this.id = id;
    this.groupId = groupId;
    this.serviceId = serviceId;
    this.tenantId = tenantId;
    this.severity = severity;
    this.messageKey = messageKey;
    this.title = title;
    this.message = message;
    this.evidence = evidence;
    this.suppressed = suppressed;
    this.sent = sent;
    this.upgradeTrigger = upgradeTrigger;
    this.createdAt = createdAt || new Date();
  }
}

class SendHistoryEntry {
  constructor({
    id,
    groupId,
    serviceId,
    tenantId,
    severity,
    title,
    sendType,
    upgradeReason = null,
    suppressedCount = 0,
    sentAt = null
  }) {
    this.id = id;
    this.groupId = groupId;
    this.serviceId = serviceId;
    this.tenantId = tenantId;
    this.severity = severity;
    this.title = title;
    this.sendType = sendType;
    this.upgradeReason = upgradeReason;
    this.suppressedCount = suppressedCount;
    this.sentAt = sentAt || new Date();
  }
}

function getSeverityLevel(severity) {
  const idx = SEVERITY_ORDER.indexOf(severity);
  return idx === -1 ? 0 : idx;
}

function isHighSeverity(severity) {
  return getSeverityLevel(severity) >= getSeverityLevel('error');
}

function getHigherSeverity(current, target) {
  return getSeverityLevel(target) > getSeverityLevel(current) ? target : current;
}

module.exports = {
  SEVERITY_ORDER,
  Service,
  TenantRule,
  NotificationGroup,
  Notification,
  SendHistoryEntry,
  getSeverityLevel,
  isHighSeverity,
  getHigherSeverity
};

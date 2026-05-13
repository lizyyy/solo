const { v4: uuidv4 } = require('uuid');

class MemoryStore {
  constructor() {
    this.services = new Map();
    this.tenantRules = new Map();
    this.notificationGroups = new Map();
    this.notifications = new Map();
    this.sendHistory = [];
    this.suppressedCounts = new Map();
    this.tenantFailureCounts = new Map();
  }

  generateId() {
    return uuidv4();
  }

  upsertService(service) {
    this.services.set(service.id, service);
    return service;
  }

  getService(serviceId) {
    return this.services.get(serviceId);
  }

  getAllServices() {
    return Array.from(this.services.values());
  }

  upsertTenantRule(rule) {
    const key = `${rule.serviceId}:${rule.tenantId}`;
    this.tenantRules.set(key, rule);
    return rule;
  }

  getTenantRule(serviceId, tenantId) {
    return this.tenantRules.get(`${serviceId}:${tenantId}`);
  }

  getServiceRules(serviceId) {
    return Array.from(this.tenantRules.values()).filter(r => r.serviceId === serviceId);
  }

  upsertNotificationGroup(group) {
    this.notificationGroups.set(group.id, group);
    return group;
  }

  getNotificationGroup(groupId) {
    return this.notificationGroups.get(groupId);
  }

  findActiveGroup(serviceId, tenantId, severity, messageKey) {
    for (const group of this.notificationGroups.values()) {
      if (
        group.serviceId === serviceId &&
        group.tenantId === tenantId &&
        group.messageKey === messageKey &&
        group.status !== 'closed'
      ) {
        return group;
      }
    }
    return null;
  }

  getActiveNotificationGroups() {
    return Array.from(this.notificationGroups.values()).filter(g => g.status !== 'closed');
  }

  getAllNotificationGroups() {
    return Array.from(this.notificationGroups.values());
  }

  upsertNotification(notification) {
    this.notifications.set(notification.id, notification);
    return notification;
  }

  getNotificationsByGroup(groupId) {
    return Array.from(this.notifications.values()).filter(n => n.groupId === groupId);
  }

  addToSendHistory(entry) {
    this.sendHistory.push(entry);
  }

  getSendHistory(filters = {}) {
    let history = [...this.sendHistory];
    if (filters.serviceId) {
      history = history.filter(h => h.serviceId === filters.serviceId);
    }
    if (filters.tenantId) {
      history = history.filter(h => h.tenantId === filters.tenantId);
    }
    return history;
  }

  incrementSuppressed(groupId) {
    const count = this.suppressedCounts.get(groupId) || 0;
    this.suppressedCounts.set(groupId, count + 1);
    return count + 1;
  }

  getSuppressedCount(groupId) {
    return this.suppressedCounts.get(groupId) || 0;
  }

  incrementTenantFailure(serviceId, tenantId) {
    const key = `${serviceId}:${tenantId}`;
    const count = this.tenantFailureCounts.get(key) || 0;
    const newCount = count + 1;
    this.tenantFailureCounts.set(key, newCount);
    return newCount;
  }

  resetTenantFailure(serviceId, tenantId) {
    const key = `${serviceId}:${tenantId}`;
    this.tenantFailureCounts.set(key, 0);
  }

  getTenantFailureCount(serviceId, tenantId) {
    const key = `${serviceId}:${tenantId}`;
    return this.tenantFailureCounts.get(key) || 0;
  }
}

module.exports = new MemoryStore();

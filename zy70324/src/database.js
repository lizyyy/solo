const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const adapter = new JSONFile(this.dbPath);
    this.db = new Low(adapter, {
      customers: [],
      callbackUrls: [],
      healthChecks: [],
      notifications: [],
    });

    await this.db.read();
    await this.db.write();
  }

  async close() {
    await this.db.write();
  }

  async createCustomer(data) {
    const customer = {
      id: uuidv4(),
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.data.customers.push(customer);
    await this.db.write();
    return customer;
  }

  async getCustomerById(id) {
    return this.db.data.customers.find(c => c.id === id) || null;
  }

  async getAllCustomers() {
    return [...this.db.data.customers];
  }

  async createCallbackUrl(data) {
    const existing = this.db.data.callbackUrls.find(
      url => url.customerId === data.customerId && url.url === data.url
    );

    if (existing) {
      return { ...existing, isDuplicate: true };
    }

    const callbackUrl = {
      id: uuidv4(),
      customerId: data.customerId,
      url: data.url,
      description: data.description || null,
      frequencyMinutes: data.frequencyMinutes || 15,
      status: 'active',
      pauseReason: null,
      pausedAt: null,
      resumedAt: null,
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastBlockedAt: null,
      createdBy: data.createdBy || 'api',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.data.callbackUrls.push(callbackUrl);
    await this.db.write();
    return callbackUrl;
  }

  async getCallbackUrlById(id) {
    return this.db.data.callbackUrls.find(url => url.id === id) || null;
  }

  async getCallbackUrlsByCustomerId(customerId) {
    return this.db.data.callbackUrls.filter(url => url.customerId === customerId);
  }

  async getActiveCallbackUrls() {
    return this.db.data.callbackUrls.filter(url => url.status === 'active');
  }

  async getAllCallbackUrls() {
    return [...this.db.data.callbackUrls];
  }

  async updateCallbackUrl(id, updates) {
    const index = this.db.data.callbackUrls.findIndex(url => url.id === id);
    if (index === -1) return null;

    this.db.data.callbackUrls[index] = {
      ...this.db.data.callbackUrls[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.db.write();
    return this.db.data.callbackUrls[index];
  }

  async pauseCallbackUrl(id, reason) {
    return this.updateCallbackUrl(id, {
      status: 'paused',
      pauseReason: reason,
      pausedAt: new Date().toISOString(),
    });
  }

  async resumeCallbackUrl(id) {
    return this.updateCallbackUrl(id, {
      status: 'active',
      resumedAt: new Date().toISOString(),
    });
  }

  async blockCallbackUrl(id) {
    return this.updateCallbackUrl(id, {
      status: 'blocked',
      lastBlockedAt: new Date().toISOString(),
    });
  }

  async createHealthCheck(data) {
    const healthCheck = {
      id: uuidv4(),
      callbackUrlId: data.callbackUrlId,
      customerId: data.customerId,
      url: data.url,
      status: data.status,
      responseTimeMs: data.responseTimeMs || null,
      httpStatusCode: data.httpStatusCode || null,
      certificateStatus: data.certificateStatus || null,
      certificateExpiryDate: data.certificateExpiryDate || null,
      errorMessage: data.errorMessage || null,
      isSlowResponse: data.isSlowResponse || false,
      createdAt: new Date().toISOString(),
    };

    this.db.data.healthChecks.push(healthCheck);
    await this.db.write();
    return healthCheck;
  }

  async getHealthChecksByCallbackUrlId(callbackUrlId, limit = 100) {
    return this.db.data.healthChecks
      .filter(hc => hc.callbackUrlId === callbackUrlId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getHealthChecksByCustomerId(customerId, limit = 100) {
    return this.db.data.healthChecks
      .filter(hc => hc.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getRecentHealthChecks(minutes) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    return this.db.data.healthChecks.filter(hc => hc.createdAt >= cutoff);
  }

  async createNotification(data) {
    const notification = {
      id: uuidv4(),
      customerId: data.customerId,
      callbackUrlId: data.callbackUrlId,
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      sentAt: data.sentAt ? new Date(data.sentAt).toISOString() : new Date().toISOString(),
      delivered: data.delivered || false,
      deliveryError: data.deliveryError || null,
      acknowledged: false,
      acknowledgedAt: null,
      createdAt: new Date().toISOString(),
    };

    this.db.data.notifications.push(notification);
    await this.db.write();
    return notification;
  }

  async getPendingNotifications() {
    return this.db.data.notifications.filter(n => !n.acknowledged && n.delivered);
  }

  async getNotificationsByCustomerId(customerId, limit = 100) {
    return this.db.data.notifications
      .filter(n => n.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async acknowledgeNotification(id) {
    const index = this.db.data.notifications.findIndex(n => n.id === id);
    if (index === -1) return null;

    this.db.data.notifications[index] = {
      ...this.db.data.notifications[index],
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    };

    await this.db.write();
    return this.db.data.notifications[index];
  }
}

module.exports = Database;
const storage = require('../data/models');

const DEDUP_TTL = 5 * 60 * 1000;

function generateDedupKey(...parts) {
  return parts.join('|');
}

function checkAndStoreDedup(key) {
  const now = Date.now();
  const existing = storage.dedupKeys.get(key);
  if (existing && now - existing < DEDUP_TTL) {
    return false;
  }
  storage.dedupKeys.set(key, now);
  return true;
}

function cleanExpiredDedup() {
  const now = Date.now();
  for (const [key, time] of storage.dedupKeys) {
    if (now - time > DEDUP_TTL) {
      storage.dedupKeys.delete(key);
    }
  }
}

function getQueueMetrics(queueName) {
  return storage.queueMetrics.get(queueName) || [];
}

function addQueueMetrics(queueName, metrics) {
  if (!storage.queueMetrics.has(queueName)) {
    storage.queueMetrics.set(queueName, []);
  }
  const list = storage.queueMetrics.get(queueName);
  const dedupKey = generateDedupKey('metric', queueName, metrics.timestamp);
  if (!checkAndStoreDedup(dedupKey)) {
    return false;
  }
  list.push({ ...metrics, queueName });
  if (list.length > 1440) {
    list.shift();
  }
  return true;
}

function getConsumerHeartbeats(groupId) {
  return storage.consumerHeartbeats.get(groupId) || [];
}

function addConsumerHeartbeat(groupId, heartbeat) {
  if (!storage.consumerHeartbeats.has(groupId)) {
    storage.consumerHeartbeats.set(groupId, []);
  }
  const list = storage.consumerHeartbeats.get(groupId);
  const dedupKey = generateDedupKey('heartbeat', groupId, heartbeat.timestamp);
  if (!checkAndStoreDedup(dedupKey)) {
    return false;
  }
  list.push({ ...heartbeat, groupId });
  if (list.length > 600) {
    list.shift();
  }
  return true;
}

function getLatestHeartbeat(groupId) {
  const list = getConsumerHeartbeats(groupId);
  return list.length > 0 ? list[list.length - 1] : null;
}

function getRetryQueueStatus(retryName) {
  return storage.retryQueues.get(retryName) || null;
}

function updateRetryQueueStatus(retryName, status) {
  const dedupKey = generateDedupKey('retry', retryName, status.timestamp);
  if (!checkAndStoreDedup(dedupKey)) {
    return false;
  }
  storage.retryQueues.set(retryName, { ...status, retryName });
  return true;
}

function getFailureSamples(queueName) {
  return storage.failureSamples.get(queueName) || [];
}

function addFailureSample(queueName, sample) {
  if (!storage.failureSamples.has(queueName)) {
    storage.failureSamples.set(queueName, []);
  }
  const list = storage.failureSamples.get(queueName);
  const dedupKey = generateDedupKey('failure', queueName, sample.timestamp, sample.messageId || Math.random());
  if (!checkAndStoreDedup(dedupKey)) {
    return false;
  }
  list.push({ ...sample, queueName });
  if (list.length > 100) {
    list.shift();
  }
  return true;
}

function getAlerts(queueName) {
  const alerts = [];
  for (const [id, alert] of storage.alerts) {
    if (!queueName || alert.queueName === queueName) {
      alerts.push(alert);
    }
  }
  return alerts;
}

function getActiveAlerts(queueName) {
  return getAlerts(queueName).filter(a => a.status === 'open');
}

function createAlert(alert) {
  const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newAlert = {
    ...alert,
    id,
    status: 'open',
    createdAt: Date.now(),
    acknowledgedAt: null,
    reopenedAt: null,
    reopenCount: 0,
    history: [{ action: 'created', timestamp: Date.now() }]
  };
  storage.alerts.set(id, newAlert);
  return newAlert;
}

function acknowledgeAlert(alertId) {
  const alert = storage.alerts.get(alertId);
  if (!alert) return null;
  alert.status = 'acknowledged';
  alert.acknowledgedAt = Date.now();
  alert.history.push({ action: 'acknowledged', timestamp: Date.now() });
  storage.alerts.set(alertId, alert);
  return alert;
}

function reopenAlert(alertId) {
  const alert = storage.alerts.get(alertId);
  if (!alert) return null;
  alert.status = 'open';
  alert.reopenedAt = Date.now();
  alert.reopenCount = (alert.reopenCount || 0) + 1;
  alert.history.push({ action: 'reopened', timestamp: Date.now() });
  storage.alerts.set(alertId, alert);
  return alert;
}

function resolveAlert(alertId) {
  const alert = storage.alerts.get(alertId);
  if (!alert) return null;
  alert.status = 'resolved';
  alert.resolvedAt = Date.now();
  alert.history.push({ action: 'resolved', timestamp: Date.now() });
  storage.alerts.set(alertId, alert);
  return alert;
}

function getAlert(alertId) {
  return storage.alerts.get(alertId) || null;
}

module.exports = {
  generateDedupKey,
  checkAndStoreDedup,
  cleanExpiredDedup,
  getQueueMetrics,
  addQueueMetrics,
  getConsumerHeartbeats,
  addConsumerHeartbeat,
  getLatestHeartbeat,
  getRetryQueueStatus,
  updateRetryQueueStatus,
  getFailureSamples,
  addFailureSample,
  getAlerts,
  getActiveAlerts,
  createAlert,
  acknowledgeAlert,
  reopenAlert,
  resolveAlert,
  getAlert
};

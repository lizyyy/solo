const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const config = {
  mergeSameServiceDifferentMetrics: false,
  recurrenceWindowMinutes: 30,
  notificationThrottleMinutes: 15,
  escalationAfterMinutes: 5
};

function calculateFingerprint(alert) {
  const { service, metric, source } = alert;
  
  let hashData = { service, source };
  
  if (metric) {
    hashData.metric = metric;
  }
  
  const hashString = Object.keys(hashData).sort().map(k => `${k}:${hashData[k]}`).join('|');
  return crypto.createHash('sha256').update(hashString).digest('hex').substring(0, 16);
}

function promisifyDbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function promisifyDbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function promisifyDbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function findMatchingEvent(fingerprint, service, alert) {
  const openEvent = await promisifyDbGet(
    `SELECT * FROM events 
     WHERE fingerprint = ? AND status IN ('open', 'acknowledged', 'escalated')
     ORDER BY created_at DESC LIMIT 1`,
    [fingerprint]
  );
  
  if (openEvent) {
    return { event: openEvent, isNew: false };
  }
  
  const recurrenceWindow = Date.now() - config.recurrenceWindowMinutes * 60 * 1000;
  const recentClosedEvent = await promisifyDbGet(
    `SELECT * FROM events 
     WHERE fingerprint = ? AND status = 'closed' AND closed_at > ?
     ORDER BY closed_at DESC LIMIT 1`,
    [fingerprint, recurrenceWindow]
  );
  
  if (recentClosedEvent) {
    return { event: recentClosedEvent, isNew: false, isRecurrence: true };
  }
  
  return { event: null, isNew: true };
}

async function createEvent(alert, fingerprint) {
  const now = Date.now();
  const eventId = uuidv4();
  const affectedServices = JSON.stringify([alert.service]);
  
  await promisifyDbRun(
    `INSERT INTO events (
      id, fingerprint, title, description, service, severity, status, 
      affected_services, first_seen_at, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
    [
      eventId, fingerprint, alert.title, alert.description || '', 
      alert.service, alert.severity, affectedServices, now, now, now, now
    ]
  );
  
  await addTimelineEntry(eventId, 'event_created', 'system', '事件已创建', {
    source: alert.source, alert_id: alert.source_alert_id });
  
  return eventId;
}

async function updateEventForRecurrence(eventId, alert) {
  const now = Date.now();
  
  await promisifyDbRun(
    `UPDATE events SET 
      status = 'open',
      last_seen_at = ?,
      updated_at = ?,
      closed_at = NULL,
      closed_reason = NULL,
      acknowledged_at = NULL,
      escalated_at = NULL,
      assignee = NULL
     WHERE id = ?`,
    [now, now, eventId]
  );
  
  await addTimelineEntry(eventId, 'event_reopened', 'system', '事件复发，已重新打开', {
    recurrence_window_minutes: config.recurrenceWindowMinutes });
  await updateEventSeverity(eventId, alert.severity);
}

async function updateEventWithAlert(eventId, alert, isNewAlert = false) {
  const now = Date.now();
  let updateFields = ['last_seen_at = ?', 'updated_at = ?'];
  let updateParams = [now, now];
  
  if (isNewAlert) {
    updateFields.push('status = ?');
    updateParams.push('open');
  }
  
  const sql = `UPDATE events SET ${updateFields.join(', ')} WHERE id = ?`;
  updateParams.push(eventId);
  
  await promisifyDbRun(sql, updateParams);
  await updateEventSeverity(eventId, alert.severity);
}

async function updateEventSeverity(eventId, newSeverity) {
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  
  const event = await promisifyDbGet('SELECT severity FROM events WHERE id = ?', [eventId]);
  
  if (event && severityOrder[newSeverity] > severityOrder[event.severity]) {
    await promisifyDbRun('UPDATE events SET severity = ?, updated_at = ? WHERE id = ?', [newSeverity, Date.now(), eventId]);
    await addTimelineEntry(eventId, 'severity_updated', 'system', `严重级别已升级为 ${newSeverity}`, {
      old_severity: event.severity, new_severity: newSeverity });
  }
}

async function addAlert(alert, eventId) {
  const now = Date.now();
  const alertId = uuidv4();
  
  await promisifyDbRun(
    `INSERT INTO alerts (
      id, event_id, source, source_alert_id, title, description, 
      service, metric, severity, fingerprint, affected_user_id, 
      affected_user_name, raw_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      alertId, eventId, alert.source, alert.source_alert_id || null,
      alert.title, alert.description || '', alert.service, alert.metric || null,
      alert.severity, alert.fingerprint, alert.affected_user_id || null,
      alert.affected_user_name || null, JSON.stringify(alert), now
    ]
  );
  
  await addTimelineEntry(eventId, 'alert_added', 'system', `新增告警来自 ${alert.source}`, {
    alert_id: alertId, source: alert.source });
  
  return alertId;
}

async function updateAffectedUsers(eventId, affectedUserId, alertAlreadyAdded = false) {
  if (!affectedUserId) return false;
  
  const event = await promisifyDbGet('SELECT affected_users FROM events WHERE id = ?', [eventId]);
  if (!event) return false;
  
  const existingUsers = await promisifyDbAll(
    `SELECT DISTINCT affected_user_id FROM alerts WHERE event_id = ? AND affected_user_id IS NOT NULL`,
    [eventId]
  );
  
  const userIds = existingUsers.map(u => u.affected_user_id);
  
  if (!userIds.includes(affectedUserId)) {
    const countBefore = userIds.length;
    const newCount = alertAlreadyAdded ? countBefore : countBefore + 1;
    if (newCount > event.affected_users) {
      await promisifyDbRun('UPDATE events SET affected_users = ?, updated_at = ? WHERE id = ?', [newCount, Date.now(), eventId]);
      await addTimelineEntry(eventId, 'user_affected', 'system', `影响用户数增加到 ${newCount}`, {
        user_id: affectedUserId });
      return true;
    }
  }
  
  return false;
}

async function shouldSendNotification(eventId) {
  const throttleWindow = Date.now() - config.notificationThrottleMinutes * 60 * 1000;
  
  const recentNotification = await promisifyDbGet(
    `SELECT * FROM notifications WHERE event_id = ? AND sent_at > ? ORDER BY sent_at DESC LIMIT 1`,
    [eventId, throttleWindow]
  );
  
  return !recentNotification;
}

async function createNotification(eventId, channel, recipient, message) {
  const now = Date.now();
  const notificationId = uuidv4();
  
  await promisifyDbRun(
    `INSERT INTO notifications (id, event_id, channel, recipient, message, sent_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [notificationId, eventId, channel, recipient, message, now]
  );
  
  await addTimelineEntry(eventId, 'notification_sent', 'system', `已通过 ${channel} 发送通知给 ${recipient}`, {
    notification_id: notificationId, channel, recipient });
  
  return notificationId;
}

async function addTimelineEntry(eventId, type, actor, description, metadata = {}) {
  const now = Date.now();
  const entryId = uuidv4();
  
  await promisifyDbRun(
    `INSERT INTO timeline (id, event_id, type, actor, description, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entryId, eventId, type, actor || null, description, JSON.stringify(metadata), now]
  );
  
  return entryId;
}

async function acknowledgeEvent(eventId, assignee) {
  const now = Date.now();
  
  await promisifyDbRun(
    `UPDATE events SET status = 'acknowledged', acknowledged_at = ?, assignee = ?, updated_at = ? WHERE id = ?`,
    [now, assignee, now, eventId]
  );
  
  await addTimelineEntry(eventId, 'event_acknowledged', assignee, '事件已确认', { assignee });
}

async function escalateEvent(eventId, assignee, reason) {
  const now = Date.now();
  
  await promisifyDbRun(
    `UPDATE events SET status = 'escalated', escalated_at = ?, assignee = ?, updated_at = ? WHERE id = ?`,
    [now, assignee, now, eventId]
  );
  
  await addTimelineEntry(eventId, 'event_escalated', assignee || 'system', '事件已升级', { reason });
}

async function closeEvent(eventId, closedReason, actor) {
  const now = Date.now();
  
  await promisifyDbRun(
    `UPDATE events SET status = 'closed', closed_at = ?, closed_reason = ?, updated_at = ? WHERE id = ?`,
    [now, closedReason, now, eventId]
  );
  
  await addTimelineEntry(eventId, 'event_closed', actor || 'system', '事件已关闭', { reason: closedReason });
}

async function getEventWithDetails(eventId) {
  const event = await promisifyDbGet('SELECT * FROM events WHERE id = ?', [eventId]);
  if (!event) return null;
  
  const alerts = await promisifyDbAll('SELECT * FROM alerts WHERE event_id = ? ORDER BY created_at DESC', [eventId]);
  const notifications = await promisifyDbAll('SELECT * FROM notifications WHERE event_id = ? ORDER BY sent_at DESC', [eventId]);
  const timeline = await promisifyDbAll('SELECT * FROM timeline WHERE event_id = ? ORDER BY created_at ASC', [eventId]);
  
  const evidenceBySource = {};
  alerts.forEach(alert => {
    if (!evidenceBySource[alert.source]) {
      evidenceBySource[alert.source] = [];
    }
    evidenceBySource[alert.source].push({
      id: alert.id,
      title: alert.title,
      description: alert.description,
      metric: alert.metric,
      severity: alert.severity,
      affected_user_id: alert.affected_user_id,
      affected_user_name: alert.affected_user_name,
      created_at: alert.created_at
    });
  });
  
  return {
    event: {
      ...event,
      affected_services: JSON.parse(event.affected_services)
    },
    alerts,
    notifications,
    timeline,
    evidence_by_source: evidenceBySource,
    current_assignee: event.assignee
  };
}

async function listEvents(status = null) {
  let sql = 'SELECT * FROM events';
  let params = [];
  
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY last_seen_at DESC';
  
  return promisifyDbAll(sql, params);
}

async function checkAndEscalate(eventId) {
  const event = await promisifyDbGet('SELECT * FROM events WHERE id = ?', [eventId]);
  if (!event) return false;
  
  if (event.status !== 'open') return false;
  
  const escalationTime = event.first_seen_at + config.escalationAfterMinutes * 60 * 1000;
  if (Date.now() < escalationTime) return false;
  
  await escalateEvent(eventId, null, '自动升级：事件未在规定时间内确认');
  return true;
}

module.exports = {
  config,
  calculateFingerprint,
  findMatchingEvent,
  createEvent,
  updateEventForRecurrence,
  updateEventWithAlert,
  addAlert,
  updateAffectedUsers,
  shouldSendNotification,
  createNotification,
  acknowledgeEvent,
  escalateEvent,
  closeEvent,
  getEventWithDetails,
  listEvents,
  checkAndEscalate,
  promisifyDbGet,
  promisifyDbAll
};

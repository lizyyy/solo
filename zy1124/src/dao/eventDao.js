const crypto = require('crypto');
const { run, get, all } = require('../db');
const { EVENT_STATUSES } = require('../db/schema');

function computePayloadHash(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

async function createEvent(data) {
  const payloadHash = computePayloadHash(data.raw_body);
  
  const existing = await get('SELECT * FROM webhook_events WHERE payload_hash = ?', [payloadHash]);
  if (existing) {
    return { duplicate: true, event: existing };
  }
  
  if (data.event_id) {
    const existingByEventId = await get(`
      SELECT * FROM webhook_events WHERE provider_id = ? AND event_id = ?
    `, [data.provider_id, data.event_id]);
    if (existingByEventId) {
      return { duplicate: true, event: existingByEventId };
    }
  }
  
  const result = await run(`
    INSERT INTO webhook_events (
      provider_id, provider_name, event_id, payload_hash,
      raw_body, headers, method, path, max_attempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.provider_id,
    data.provider_name,
    data.event_id || null,
    payloadHash,
    data.raw_body,
    JSON.stringify(data.headers || {}),
    data.method || 'POST',
    data.path,
    data.max_attempts || 5
  ]);
  
  const event = await getEventById(result.lastID);
  return { duplicate: false, event };
}

async function getEventById(id) {
  return get('SELECT * FROM webhook_events WHERE id = ?', [id]);
}

async function getEventsByEventId(providerId, eventId) {
  return all(`
    SELECT * FROM webhook_events WHERE provider_id = ? AND event_id = ?
  `, [providerId, eventId]);
}

async function listEvents(filters = {}) {
  const conditions = [];
  const values = [];
  
  if (filters.provider_name) {
    conditions.push('provider_name = ?');
    values.push(filters.provider_name);
  }
  if (filters.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }
  if (filters.event_id) {
    conditions.push('event_id = ?');
    values.push(filters.event_id);
  }
  if (filters.since) {
    conditions.push('received_at >= ?');
    values.push(filters.since);
  }
  if (filters.until) {
    conditions.push('received_at <= ?');
    values.push(filters.until);
  }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = 'ORDER BY received_at DESC';
  const limit = filters.limit ? `LIMIT ${parseInt(filters.limit)}` : '';
  
  return all(`SELECT * FROM webhook_events ${where} ${order} ${limit}`, values);
}

async function updateEventStatus(id, status, extra = {}) {
  const event = await getEventById(id);
  if (!event) return null;
  
  const updates = ['status = ?'];
  const values = [status];
  
  if (status === EVENT_STATUSES.SUCCESS || status === EVENT_STATUSES.DISCARDED) {
    updates.push('processed_at = strftime("%s", "now")');
    updates.push('next_retry_at = NULL');
  }
  
  if (extra.last_attempt_at !== undefined) {
    updates.push('last_attempt_at = ?');
    values.push(extra.last_attempt_at);
  }
  if (extra.attempt_count !== undefined) {
    updates.push('attempt_count = ?');
    values.push(extra.attempt_count);
  }
  if (extra.next_retry_at !== undefined) {
    updates.push('next_retry_at = ?');
    values.push(extra.next_retry_at);
  }
  
  values.push(id);
  await run(`UPDATE webhook_events SET ${updates.join(', ')} WHERE id = ?`, values);
  
  return getEventById(id);
}

async function getEventsForRetry(now) {
  return all(`
    SELECT * FROM webhook_events 
    WHERE status = ? AND next_retry_at IS NOT NULL AND next_retry_at <= ?
    ORDER BY next_retry_at ASC
  `, [EVENT_STATUSES.FAILED_RETRY, now]);
}

async function getFailureStatistics(since, until) {
  let sql = `
    SELECT 
      status,
      COUNT(*) as count
    FROM webhook_events
    WHERE 1=1
  `;
  const values = [];
  
  if (since) {
    sql += ' AND received_at >= ?';
    values.push(since);
  }
  if (until) {
    sql += ' AND received_at <= ?';
    values.push(until);
  }
  
  sql += ' GROUP BY status';
  
  return all(sql, values);
}

async function getProviderStatistics(providerName, since, until) {
  let sql = `
    SELECT 
      status,
      COUNT(*) as count
    FROM webhook_events
    WHERE provider_name = ?
  `;
  const values = [providerName];
  
  if (since) {
    sql += ' AND received_at >= ?';
    values.push(since);
  }
  if (until) {
    sql += ' AND received_at <= ?';
    values.push(until);
  }
  
  sql += ' GROUP BY status';
  
  return all(sql, values);
}

module.exports = {
  createEvent,
  getEventById,
  getEventsByEventId,
  listEvents,
  updateEventStatus,
  getEventsForRetry,
  getFailureStatistics,
  getProviderStatistics,
  computePayloadHash,
};

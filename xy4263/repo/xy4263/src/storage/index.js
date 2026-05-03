const { v4: uuidv4 } = require('uuid');

class Storage {
  constructor(db) {
    this.db = db;
  }

  now() {
    return Math.floor(Date.now() / 1000);
  }

  createSubscription(endpoint, secret) {
    const id = uuidv4();
    const now = this.now();
    
    this.db.prepare(`
      INSERT INTO subscriptions (id, endpoint, secret, active, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(id, endpoint, secret, now, now);

    return this.getSubscription(id);
  }

  getSubscription(id) {
    return this.db.prepare(`
      SELECT id, endpoint, active, created_at, updated_at
      FROM subscriptions
      WHERE id = ?
    `).get(id);
  }

  getSubscriptionWithSecret(id) {
    return this.db.prepare(`
      SELECT * FROM subscriptions WHERE id = ?
    `).get(id);
  }

  listSubscriptions() {
    return this.db.prepare(`
      SELECT id, endpoint, active, created_at, updated_at
      FROM subscriptions
      ORDER BY created_at DESC
    `).all();
  }

  updateSubscription(id, updates) {
    const now = this.now();
    const fields = ['updated_at = ?'];
    const values = [now];

    if (updates.endpoint !== undefined) {
      fields.push('endpoint = ?');
      values.push(updates.endpoint);
    }
    if (updates.secret !== undefined) {
      fields.push('secret = ?');
      values.push(updates.secret);
    }
    if (updates.active !== undefined) {
      fields.push('active = ?');
      values.push(updates.active ? 1 : 0);
    }

    values.push(id);

    this.db.prepare(`
      UPDATE subscriptions
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);

    return this.getSubscription(id);
  }

  deleteSubscription(id) {
    this.db.prepare('DELETE FROM dead_letters WHERE subscription_id = ?').run(id);
    this.db.prepare('DELETE FROM delivery_logs WHERE subscription_id = ?').run(id);
    this.db.prepare('DELETE FROM idempotency_keys WHERE subscription_id = ?').run(id);
    this.db.prepare('DELETE FROM events WHERE subscription_id = ?').run(id);
    return this.db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
  }

  createEvent(subscriptionId, eventType, payload, idempotencyKey = null) {
    const id = uuidv4();
    const now = this.now();

    this.db.prepare(`
      INSERT INTO events (id, subscription_id, idempotency_key, event_type, payload, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, subscriptionId, idempotencyKey, eventType, JSON.stringify(payload), now, now);

    return this.getEvent(id);
  }

  getEvent(id) {
    const row = this.db.prepare(`
      SELECT * FROM events WHERE id = ?
    `).get(id);

    if (row) {
      row.payload = JSON.parse(row.payload);
    }
    return row;
  }

  getEventsBySubscription(subscriptionId, limit = 100) {
    const rows = this.db.prepare(`
      SELECT * FROM events
      WHERE subscription_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(subscriptionId, limit);

    return rows.map(row => ({
      ...row,
      payload: JSON.parse(row.payload)
    }));
  }

  getPendingEvents() {
    const rows = this.db.prepare(`
      SELECT * FROM events
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();

    return rows.map(row => ({
      ...row,
      payload: JSON.parse(row.payload)
    }));
  }

  getRetryableEvents() {
    const rows = this.db.prepare(`
      SELECT e.*, COUNT(dl.id) as attempt_count
      FROM events e
      LEFT JOIN delivery_logs dl ON e.id = dl.event_id
      WHERE e.status IN ('pending', 'failed')
      GROUP BY e.id
      ORDER BY e.created_at ASC
    `).all();

    return rows.map(row => ({
      ...row,
      payload: JSON.parse(row.payload)
    }));
  }

  updateEventStatus(id, status) {
    const now = this.now();
    return this.db.prepare(`
      UPDATE events SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, now, id);
  }

  createDeliveryLog(eventId, subscriptionId, attempt, status, statusCode = null, responseBody = null, errorMessage = null) {
    const id = uuidv4();
    const now = this.now();

    return this.db.prepare(`
      INSERT INTO delivery_logs (id, event_id, subscription_id, attempt, status, status_code, response_body, error_message, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, eventId, subscriptionId, attempt, status, statusCode, 
         responseBody ? JSON.stringify(responseBody) : null, 
         errorMessage, now);
  }

  getDeliveryLogs(eventId) {
    const rows = this.db.prepare(`
      SELECT * FROM delivery_logs
      WHERE event_id = ?
      ORDER BY delivered_at ASC
    `).all(eventId);

    return rows.map(row => ({
      ...row,
      response_body: row.response_body ? JSON.parse(row.response_body) : null
    }));
  }

  getAllDeliveryLogs(subscriptionId = null, limit = 100) {
    let query = `
      SELECT dl.*, e.event_type
      FROM delivery_logs dl
      JOIN events e ON dl.event_id = e.id
    `;
    const params = [];

    if (subscriptionId) {
      query += ' WHERE dl.subscription_id = ?';
      params.push(subscriptionId);
    }

    query += ' ORDER BY dl.delivered_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params);

    return rows.map(row => ({
      ...row,
      response_body: row.response_body ? JSON.parse(row.response_body) : null
    }));
  }

  createDeadLetter(eventId, subscriptionId, lastError) {
    const id = uuidv4();
    const now = this.now();

    return this.db.prepare(`
      INSERT INTO dead_letters (id, event_id, subscription_id, last_error, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, eventId, subscriptionId, lastError, now);
  }

  getDeadLetters(subscriptionId = null) {
    let query = `
      SELECT dl.*, e.event_type, e.payload
      FROM dead_letters dl
      JOIN events e ON dl.event_id = e.id
    `;
    const params = [];

    if (subscriptionId) {
      query += ' WHERE dl.subscription_id = ?';
      params.push(subscriptionId);
    }

    query += ' ORDER BY dl.created_at DESC';

    const rows = this.db.prepare(query).all(...params);

    return rows.map(row => ({
      ...row,
      payload: JSON.parse(row.payload)
    }));
  }

  deleteDeadLetter(id) {
    return this.db.prepare('DELETE FROM dead_letters WHERE id = ?').run(id);
  }

  getIdempotencyKey(key, subscriptionId) {
    return this.db.prepare(`
      SELECT * FROM idempotency_keys
      WHERE key = ? AND subscription_id = ?
    `).get(key, subscriptionId);
  }

  createIdempotencyKey(key, eventId, subscriptionId, ttlSeconds) {
    const now = this.now();
    const expiresAt = now + ttlSeconds;

    return this.db.prepare(`
      INSERT INTO idempotency_keys (key, event_id, subscription_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(key, eventId, subscriptionId, now, expiresAt);
  }

  cleanExpiredIdempotencyKeys() {
    const now = this.now();
    return this.db.prepare(`
      DELETE FROM idempotency_keys WHERE expires_at < ?
    `).run(now);
  }

  getStats() {
    const subscriptions = this.db.prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;
    const eventsTotal = this.db.prepare('SELECT COUNT(*) as count FROM events').get().count;
    const eventsSuccess = this.db.prepare('SELECT COUNT(*) as count FROM events WHERE status = "delivered"').get().count;
    const eventsFailed = this.db.prepare('SELECT COUNT(*) as count FROM events WHERE status = "failed"').get().count;
    const eventsPending = this.db.prepare('SELECT COUNT(*) as count FROM events WHERE status = "pending"').get().count;
    const deadLetters = this.db.prepare('SELECT COUNT(*) as count FROM dead_letters').get().count;
    const deliveries = this.db.prepare('SELECT COUNT(*) as count FROM delivery_logs').get().count;

    return {
      subscriptions,
      events: {
        total: eventsTotal,
        success: eventsSuccess,
        failed: eventsFailed,
        pending: eventsPending,
        dead_letters: deadLetters
      },
      deliveries
    };
  }
}

module.exports = Storage;
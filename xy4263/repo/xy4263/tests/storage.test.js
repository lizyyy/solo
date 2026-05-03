const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const initDb = require('../src/storage/database');
const Storage = require('../src/storage');

describe('Storage', () => {
  let db;
  let storage;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = initDb(testDbPath);
    storage = new Storage(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Subscriptions', () => {
    it('should create a subscription', () => {
      const subscription = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.endpoint).toBe('https://example.com/webhook');
      expect(subscription.active).toBe(1);
    });

    it('should get a subscription', () => {
      const created = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );

      const retrieved = storage.getSubscription(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.endpoint).toBe(created.endpoint);
    });

    it('should get subscription with secret', () => {
      const created = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );

      const retrieved = storage.getSubscriptionWithSecret(created.id);

      expect(retrieved.secret).toBe('test-secret-key');
    });

    it('should list subscriptions', () => {
      storage.createSubscription('https://example.com/1', 'secret1');
      storage.createSubscription('https://example.com/2', 'secret2');

      const list = storage.listSubscriptions();

      expect(list.length).toBe(2);
    });

    it('should update a subscription', () => {
      const created = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );

      const updated = storage.updateSubscription(created.id, {
        endpoint: 'https://new.example.com/webhook',
        active: false
      });

      expect(updated.endpoint).toBe('https://new.example.com/webhook');
      expect(updated.active).toBe(0);
    });

    it('should delete a subscription', () => {
      const created = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );

      storage.deleteSubscription(created.id);

      const retrieved = storage.getSubscription(created.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Events', () => {
    let subscription;

    beforeEach(() => {
      subscription = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );
    });

    it('should create an event', () => {
      const event = storage.createEvent(
        subscription.id,
        'payment.succeeded',
        { amount: 100, currency: 'cny' },
        'idempotency-key-123'
      );

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.event_type).toBe('payment.succeeded');
      expect(event.payload.amount).toBe(100);
      expect(event.idempotency_key).toBe('idempotency-key-123');
      expect(event.status).toBe('pending');
    });

    it('should get an event', () => {
      const created = storage.createEvent(
        subscription.id,
        'payment.succeeded',
        { amount: 100 }
      );

      const retrieved = storage.getEvent(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.payload.amount).toBe(100);
    });

    it('should get events by subscription', () => {
      storage.createEvent(subscription.id, 'event.1', { data: 1 });
      storage.createEvent(subscription.id, 'event.2', { data: 2 });

      const events = storage.getEventsBySubscription(subscription.id);

      expect(events.length).toBe(2);
    });

    it('should get pending events', () => {
      storage.createEvent(subscription.id, 'event.1', {});
      storage.createEvent(subscription.id, 'event.2', {});

      const pending = storage.getPendingEvents();

      expect(pending.length).toBe(2);
    });

    it('should update event status', () => {
      const event = storage.createEvent(subscription.id, 'event.1', {});

      storage.updateEventStatus(event.id, 'delivered');

      const updated = storage.getEvent(event.id);
      expect(updated.status).toBe('delivered');
    });
  });

  describe('Delivery Logs', () => {
    let subscription;
    let event;

    beforeEach(() => {
      subscription = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );
      event = storage.createEvent(subscription.id, 'test.event', {});
    });

    it('should create a delivery log', () => {
      storage.createDeliveryLog(
        event.id,
        subscription.id,
        1,
        'success',
        200,
        { received: true },
        null
      );

      const logs = storage.getDeliveryLogs(event.id);

      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('success');
      expect(logs[0].status_code).toBe(200);
    });

    it('should get all delivery logs', () => {
      storage.createDeliveryLog(
        event.id,
        subscription.id,
        1,
        'success',
        200,
        null,
        null
      );

      const logs = storage.getAllDeliveryLogs();

      expect(logs.length).toBe(1);
    });
  });

  describe('Dead Letters', () => {
    let subscription;
    let event;

    beforeEach(() => {
      subscription = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );
      event = storage.createEvent(subscription.id, 'test.event', {});
    });

    it('should create a dead letter', () => {
      storage.createDeadLetter(
        event.id,
        subscription.id,
        'Connection timeout'
      );

      const deadLetters = storage.getDeadLetters();

      expect(deadLetters.length).toBe(1);
      expect(deadLetters[0].last_error).toBe('Connection timeout');
    });

    it('should delete a dead letter', () => {
      storage.createDeadLetter(
        event.id,
        subscription.id,
        'Error'
      );

      const deadLetters = storage.getDeadLetters();
      storage.deleteDeadLetter(deadLetters[0].id);

      const afterDelete = storage.getDeadLetters();
      expect(afterDelete.length).toBe(0);
    });
  });

  describe('Idempotency Keys', () => {
    let subscription;

    beforeEach(() => {
      subscription = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );
    });

    it('should create and retrieve idempotency key', () => {
      const event = storage.createEvent(
        subscription.id,
        'test.event',
        {}
      );

      storage.createIdempotencyKey(
        'test-key-123',
        event.id,
        subscription.id,
        86400
      );

      const retrieved = storage.getIdempotencyKey(
        'test-key-123',
        subscription.id
      );

      expect(retrieved).toBeDefined();
      expect(retrieved.event_id).toBe(event.id);
    });
  });

  describe('Stats', () => {
    it('should get stats', () => {
      const subscription = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );

      const stats = storage.getStats();

      expect(stats.subscriptions).toBe(1);
      expect(stats.events.total).toBe(0);
    });
  });
});
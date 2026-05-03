const Validation = require('../src/validation');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const initDb = require('../src/storage/database');
const Storage = require('../src/storage');

describe('Validation', () => {
  let db;
  let storage;
  let validation;
  const testDbPath = path.join(__dirname, 'test-validation.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = initDb(testDbPath);
    storage = new Storage(db);
    validation = new Validation(storage);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('validateEvent', () => {
    it('should validate a valid event', () => {
      const result = validation.validateEvent(
        'payment.succeeded',
        { amount: 100, currency: 'cny' }
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject missing event_type', () => {
      const result = validation.validateEvent(
        null,
        { amount: 100 }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject missing payload', () => {
      const result = validation.validateEvent(
        'payment.succeeded',
        null
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('validateSubscription', () => {
    it('should validate a valid subscription', () => {
      const result = validation.validateSubscription(
        'https://example.com/webhook',
        'my-secret-key-123'
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid URL', () => {
      const result = validation.validateSubscription(
        'not-a-url',
        'my-secret-key-123'
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('valid URL');
    });

    it('should reject short secret', () => {
      const result = validation.validateSubscription(
        'https://example.com/webhook',
        'short'
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('8 characters');
    });

    it('should reject missing endpoint', () => {
      const result = validation.validateSubscription(
        null,
        'my-secret-key-123'
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('Idempotency', () => {
    let subscription;

    beforeEach(() => {
      subscription = storage.createSubscription(
        'https://example.com/webhook',
        'test-secret-key'
      );
    });

    it('should return isDuplicate: false for new key', () => {
      const result = validation.checkIdempotency(
        'new-unique-key',
        subscription.id
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingEvent).toBeNull();
    });

    it('should return isDuplicate: true for existing key', () => {
      const event = storage.createEvent(
        subscription.id,
        'test.event',
        {}
      );

      validation.recordIdempotency(
        'duplicate-key',
        event.id,
        subscription.id
      );

      const result = validation.checkIdempotency(
        'duplicate-key',
        subscription.id
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingEvent).toBeDefined();
      expect(result.existingEvent.id).toBe(event.id);
    });

    it('should handle null idempotency key', () => {
      const result = validation.checkIdempotency(null, subscription.id);

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('extractIdempotencyKeyFromHeaders', () => {
    it('should extract from lowercase header', () => {
      const headers = {
        'x-idempotency-key': 'test-key'
      };

      const key = validation.extractIdempotencyKeyFromHeaders(headers);

      expect(key).toBe('test-key');
    });

    it('should extract from case-sensitive header', () => {
      const headers = {
        'X-Idempotency-Key': 'test-key'
      };

      const key = validation.extractIdempotencyKeyFromHeaders(headers);

      expect(key).toBe('test-key');
    });

    it('should return null for missing header', () => {
      const key = validation.extractIdempotencyKeyFromHeaders({});

      expect(key).toBeNull();
    });
  });
});
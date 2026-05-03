const config = require('../config');

class Validation {
  constructor(storage, options = {}) {
    this.storage = storage;
    this.idempotencyHeader = options.idempotencyHeader || config.idempotency.header;
    this.idempotencyTtl = options.idempotencyTtl || config.idempotency.ttlSeconds;
  }

  validateEvent(eventType, payload) {
    const errors = [];

    if (!eventType || typeof eventType !== 'string') {
      errors.push('event_type is required and must be a string');
    }

    if (!payload || typeof payload !== 'object') {
      errors.push('payload is required and must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateSubscription(endpoint, secret) {
    const errors = [];

    if (!endpoint || typeof endpoint !== 'string') {
      errors.push('endpoint is required and must be a string');
    } else {
      try {
        new URL(endpoint);
      } catch (e) {
        errors.push('endpoint must be a valid URL');
      }
    }

    if (!secret || typeof secret !== 'string') {
      errors.push('secret is required and must be a string');
    } else if (secret.length < 8) {
      errors.push('secret must be at least 8 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  checkIdempotency(idempotencyKey, subscriptionId) {
    if (!idempotencyKey) {
      return {
        isDuplicate: false,
        existingEvent: null
      };
    }

    const existing = this.storage.getIdempotencyKey(idempotencyKey, subscriptionId);

    if (existing) {
      const existingEvent = this.storage.getEvent(existing.event_id);
      return {
        isDuplicate: true,
        existingEvent
      };
    }

    return {
      isDuplicate: false,
      existingEvent: null
    };
  }

  recordIdempotency(idempotencyKey, eventId, subscriptionId) {
    if (!idempotencyKey) {
      return;
    }

    this.storage.createIdempotencyKey(
      idempotencyKey,
      eventId,
      subscriptionId,
      this.idempotencyTtl
    );
  }

  extractIdempotencyKeyFromHeaders(headers) {
    return headers[this.idempotencyHeader.toLowerCase()] || 
           headers[this.idempotencyHeader] ||
           null;
  }

  cleanExpiredKeys() {
    return this.storage.cleanExpiredIdempotencyKeys();
  }
}

module.exports = Validation;
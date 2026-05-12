const store = require('../data/store');

class IdempotencyService {
  constructor() {
    this.processedRequests = new Map();
  }

  checkAndRecord(idempotencyKey, requestData, action) {
    const key = `${action}:${idempotencyKey}`;
    
    if (this.processedRequests.has(key)) {
      return {
        isDuplicate: true,
        originalResult: this.processedRequests.get(key)
      };
    }

    return {
      isDuplicate: false,
      record: (result) => {
        this.processedRequests.set(key, {
          result,
          requestData,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  checkCallback(callbackId) {
    const key = `callback:${callbackId}`;
    
    if (store.pendingCallbacks.has(key)) {
      const existing = store.pendingCallbacks.get(key);
      if (existing.status === 'processed') {
        return {
          isDuplicate: true,
          originalResult: existing
        };
      }
    }

    return {
      isDuplicate: false,
      record: (result) => {
        store.pendingCallbacks.set(key, {
          callbackId,
          status: 'processed',
          result,
          timestamp: new Date().toISOString()
        });
      }
    };
  }
}

module.exports = new IdempotencyService();

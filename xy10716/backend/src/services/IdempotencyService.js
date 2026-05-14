const StateHistory = require('../models/StateHistory');

class IdempotencyService {
  constructor() {
    this.defaultWindowMs = 60000;
  }

  async checkIdempotency(idempotencyKey, switchId, windowMs = this.defaultWindowMs) {
    if (!idempotencyKey) {
      return { isDuplicate: false };
    }

    const cutoffTime = new Date(Date.now() - windowMs);
    
    const existingRecord = await StateHistory.findOne({
      idempotencyKey,
      switchId,
      createdAt: { $gte: cutoffTime }
    });

    if (existingRecord) {
      return {
        isDuplicate: true,
        existingRecord,
        message: 'Duplicate request detected'
      };
    }

    return { isDuplicate: false };
  }

  async checkAndGetDuplicate(idempotencyKey, switchId) {
    const existingRecord = await StateHistory.findOne({
      idempotencyKey,
      switchId
    });

    if (existingRecord) {
      return {
        isDuplicate: true,
        existingRecord,
        message: 'Duplicate request detected'
      };
    }

    return { isDuplicate: false };
  }

  generateIdempotencyKey() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async getRecentRequests(switchId, windowMs = this.defaultWindowMs) {
    const cutoffTime = new Date(Date.now() - windowMs);
    
    return await StateHistory.find({
      switchId,
      createdAt: { $gte: cutoffTime }
    }).sort({ createdAt: -1 });
  }
}

module.exports = new IdempotencyService();

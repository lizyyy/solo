const moment = require('moment');

class DuplicateSubmitError extends Error {
  constructor(message, code = 'DUPLICATE_SUBMIT_ERROR') {
    super(message);
    this.name = 'DuplicateSubmitError';
    this.code = code;
    this.status = 409;
  }
}

class DuplicateSubmitValidator {
  constructor() {
    this.submissionCache = new Map();
    this.defaultWindowMs = 5000;
  }

  generateKey(...args) {
    return args.map(arg => String(arg)).join(':');
  }

  checkDuplicate(key, windowMs = null) {
    const effectiveWindow = windowMs !== null ? windowMs : this.defaultWindowMs;
    const now = moment();
    
    if (this.submissionCache.has(key)) {
      const lastSubmission = this.submissionCache.get(key);
      const elapsedMs = now.diff(lastSubmission);
      
      if (elapsedMs < effectiveWindow) {
        const remainingMs = effectiveWindow - elapsedMs;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        throw new DuplicateSubmitError(
          `操作过于频繁，请在 ${remainingSeconds} 秒后重试`,
          'RATE_LIMIT_EXCEEDED'
        );
      }
    }
    
    return true;
  }

  recordSubmission(key) {
    this.submissionCache.set(key, moment());
    return true;
  }

  validateAndRecord(key, windowMs = null) {
    this.checkDuplicate(key, windowMs);
    this.recordSubmission(key);
    return true;
  }

  clearCache(key = null) {
    if (key) {
      this.submissionCache.delete(key);
    } else {
      this.submissionCache.clear();
    }
    return true;
  }

  cleanupExpired(windowMs = null) {
    const effectiveWindow = windowMs !== null ? windowMs : this.defaultWindowMs;
    const now = moment();
    let cleaned = 0;
    
    for (const [key, timestamp] of this.submissionCache.entries()) {
      const elapsedMs = now.diff(timestamp);
      if (elapsedMs >= effectiveWindow) {
        this.submissionCache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  getPendingKeys(windowMs = null) {
    const effectiveWindow = windowMs !== null ? windowMs : this.defaultWindowMs;
    const now = moment();
    const pendingKeys = [];
    
    for (const [key, timestamp] of this.submissionCache.entries()) {
      const elapsedMs = now.diff(timestamp);
      if (elapsedMs < effectiveWindow) {
        pendingKeys.push({
          key,
          timestamp,
          remainingMs: effectiveWindow - elapsedMs
        });
      }
    }
    
    return pendingKeys;
  }
}

const globalValidator = new DuplicateSubmitValidator();

class RequestDuplicateValidator {
  static async checkDuplicateRequest(repository, requesterId, chemicalId, batchId, quantity, windowMinutes = 30) {
    const now = moment();
    const windowStart = now.subtract(windowMinutes, 'minutes').toISOString();
    
    const recentRequests = await repository.findAll({
      requester_id: requesterId,
      chemical_id: chemicalId,
      batch_id: batchId,
      start_date: windowStart,
      limit: 10
    });
    
    const duplicateRequest = recentRequests.find(request => {
      return Math.abs(request.quantity - quantity) < 0.001 &&
        request.status !== 'rejected' &&
        request.status !== 'returned';
    });
    
    if (duplicateRequest) {
      throw new DuplicateSubmitError(
        `检测到重复的领用申请。申请单号: ${duplicateRequest.request_number}`,
        'DUPLICATE_REQUEST'
      );
    }
    
    return true;
  }

  static async checkDuplicateBatchNumber(repository, batchNumber) {
    const existingBatch = await repository.findByBatchNumber(batchNumber);
    if (existingBatch) {
      throw new DuplicateSubmitError(
        `批次号已存在: ${batchNumber}`,
        'DUPLICATE_BATCH_NUMBER'
      );
    }
    return true;
  }

  static async checkDuplicateChemicalName(repository, name, excludeId = null) {
    const existingChemical = await repository.findByName(name);
    if (existingChemical && existingChemical.id !== excludeId) {
      throw new DuplicateSubmitError(
        `试剂名称已存在: ${name}`,
        'DUPLICATE_CHEMICAL_NAME'
      );
    }
    return true;
  }

  static async checkDuplicateCasNumber(repository, casNumber, excludeId = null) {
    if (!casNumber) return true;
    
    const existingChemical = await repository.findByCasNumber(casNumber);
    if (existingChemical && existingChemical.id !== excludeId) {
      throw new DuplicateSubmitError(
        `CAS号已存在: ${casNumber}`,
        'DUPLICATE_CAS_NUMBER'
      );
    }
    return true;
  }
}

module.exports = {
  DuplicateSubmitValidator,
  DuplicateSubmitError,
  RequestDuplicateValidator,
  globalValidator
};

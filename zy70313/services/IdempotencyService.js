import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';

const RECORD_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CONFLICT: 'conflict',
};

class IdempotencyService {
  constructor() {
    this.records = new Map();
    this.auditLogs = new Map();
  }

  computeFingerprint(request) {
    const keyFields = this.getKeyFields(request);
    const sorted = JSON.stringify(keyFields, Object.keys(keyFields).sort());
    return crypto
      .createHash('sha256')
      .update(sorted)
      .digest('hex');
  }

  getKeyFields(request) {
    return {
      amount: request.amount,
      userId: request.userId,
      orderId: request.orderId || request.refundId || request.couponBatchId,
      currency: request.currency,
      businessType: request.businessType,
      ...(request.extra && typeof request.extra === 'object' ? request.extra : {}),
    };
  }

  createRequestSummary(request, fingerprint) {
    return {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      keyFields: this.getKeyFields(request),
      fingerprint,
      rawRequest: request,
    };
  }

  getOrCreateRecord(idempotencyKey, request) {
    let record = this.records.get(idempotencyKey);
    const now = Date.now();

    if (!record) {
      const fingerprint = this.computeFingerprint(request);
      const summary = this.createRequestSummary(request, fingerprint);
      record = {
        idempotencyKey,
        status: RECORD_STATUS.PENDING,
        createdAt: now,
        expiresAt: now + config.idempotency.defaultTTL * 1000,
        firstRequest: summary,
        requests: [summary],
        businessResult: null,
        conflictReason: null,
        processingSince: now,
      };
      this.records.set(idempotencyKey, record);
      return { record, isNew: true, fingerprintMatch: true };
    }

    const expired = now > record.expiresAt;
    if (expired) {
      if (!config.idempotency.allowReuseAfterExpiry) {
        const auditSummary = this.createAuditSummary(record);
        this.auditLogs.set(idempotencyKey, {
          ...auditSummary,
          expiredAt: now,
        });
        return { record, isNew: false, fingerprintMatch: false, expired: true, forbidden: true };
      } else {
        const auditSummary = this.createAuditSummary(record);
        this.auditLogs.set(idempotencyKey, auditSummary);
        
        const fingerprint = this.computeFingerprint(request);
        const summary = this.createRequestSummary(request, fingerprint);
        record = {
          idempotencyKey,
          status: RECORD_STATUS.PENDING,
          createdAt: now,
          expiresAt: now + config.idempotency.defaultTTL * 1000,
          firstRequest: summary,
          requests: [summary],
          businessResult: null,
          conflictReason: null,
          processingSince: now,
        };
        this.records.set(idempotencyKey, record);
        return { record, isNew: true, fingerprintMatch: true, reusedAfterExpiry: true };
      }
    }

    const currentFingerprint = this.computeFingerprint(request);
    const fingerprintMatch = currentFingerprint === record.firstRequest.fingerprint;
    const summary = this.createRequestSummary(request, currentFingerprint);
    record.requests.push(summary);

    return { record, isNew: false, fingerprintMatch };
  }

  updateRecordStatus(idempotencyKey, status, result = null) {
    const record = this.records.get(idempotencyKey);
    if (record) {
      record.status = status;
      record.businessResult = result;
      record.processingSince = null;
    }
  }

  markAsConflict(idempotencyKey, reason) {
    const record = this.records.get(idempotencyKey);
    if (record) {
      record.status = RECORD_STATUS.CONFLICT;
      record.conflictReason = reason;
    }
  }

  getRecord(idempotencyKey) {
    return this.records.get(idempotencyKey);
  }

  getAuditSummary(idempotencyKey) {
    return this.auditLogs.get(idempotencyKey);
  }

  cleanupExpired() {
    const now = Date.now();
    const cleaned = [];
    
    for (const [key, record] of this.records) {
      if (now > record.expiresAt) {
        const auditSummary = this.createAuditSummary(record);
        this.auditLogs.set(key, {
          ...auditSummary,
          cleanedAt: now,
        });
        this.records.delete(key);
        cleaned.push(key);
      }
    }
    
    return {
      count: cleaned.length,
      keys: cleaned,
      timestamp: new Date().toISOString(),
    };
  }

  createAuditSummary(record) {
    return {
      idempotencyKey: record.idempotencyKey,
      status: record.status,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      requestCount: record.requests.length,
      firstRequest: {
        timestamp: record.firstRequest.timestamp,
        keyFields: record.firstRequest.keyFields,
        fingerprint: record.firstRequest.fingerprint,
      },
      businessResult: record.businessResult ? {
        success: record.businessResult.success,
        code: record.businessResult.code,
        message: record.businessResult.message,
      } : null,
      conflictReason: record.conflictReason,
    };
  }

  compareRequests(record, index1, index2) {
    if (!record || index1 < 0 || index2 < 0 || 
        index1 >= record.requests.length || index2 >= record.requests.length) {
      return null;
    }

    const req1 = record.requests[index1];
    const req2 = record.requests[index2];
    const diff = [];

    const allFields = new Set([
      ...Object.keys(req1.keyFields),
      ...Object.keys(req2.keyFields),
    ]);

    for (const field of allFields) {
      const v1 = req1.keyFields[field];
      const v2 = req2.keyFields[field];
      if (JSON.stringify(v1) !== JSON.stringify(v2)) {
        diff.push({
          field,
          request1: {
            value: v1,
            timestamp: req1.timestamp,
          },
          request2: {
            value: v2,
            timestamp: req2.timestamp,
          },
        });
      }
    }

    return {
      index1,
      index2,
      request1Id: req1.requestId,
      request2Id: req2.requestId,
      sameFingerprint: req1.fingerprint === req2.fingerprint,
      differences: diff,
      totalDifferences: diff.length,
    };
  }

  getStatus() {
    return RECORD_STATUS;
  }
}

export const idempotencyService = new IdempotencyService();
export { RECORD_STATUS };

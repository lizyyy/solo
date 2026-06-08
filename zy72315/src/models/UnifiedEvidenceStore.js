class UnifiedEvidenceStore {
  constructor() {
    this.records = new Map();
    this.auditLog = [];
  }

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  _setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    return obj;
  }

  _getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  addBoundaryRecord(recordId, boundaryData) {
    const existing = this.records.get(recordId) || {
      recordId,
      boundaryEvidence: null,
      scoringEvidence: null,
      unifiedResult: null,
      auditTrail: [],
      currentStatus: 'pending_import',
      manualChanges: [],
      reviewStatus: 'pending',
      reviewer: null,
      reviewComment: null,
      nextHandler: null,
      reviewTimeline: []
    };

    const clonedRaw = this._deepClone(boundaryData.rawData || boundaryData);

    existing.boundaryEvidence = {
      ...boundaryData,
      originalLineNumber: boundaryData.lineNumber,
      importTimestamp: new Date().toISOString(),
      rawData: clonedRaw,
      originalRawData: this._deepClone(clonedRaw)
    };
    existing.currentStatus = 'boundary_imported';
    existing.auditTrail.push({
      action: 'boundary_imported',
      timestamp: new Date().toISOString(),
      operator: boundaryData.operator || 'system',
      note: `从边界值说明导入，原始行号: ${boundaryData.lineNumber}`,
      snapshot: { rawData: this._deepClone(clonedRaw) }
    });

    this.records.set(recordId, existing);
    this._logAudit('add_boundary', recordId, boundaryData.operator);
    return existing;
  }

  addScoringRecord(recordId, scoringData) {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在，请先导入边界值说明`);
    }

    const clonedRaw = this._deepClone(scoringData.rawData || scoringData);

    record.scoringEvidence = {
      ...scoringData,
      originalLineNumber: scoringData.lineNumber,
      importTimestamp: new Date().toISOString(),
      rawData: clonedRaw,
      originalRawData: this._deepClone(clonedRaw)
    };
    record.currentStatus = 'scoring_imported';
    record.auditTrail.push({
      action: 'scoring_imported',
      timestamp: new Date().toISOString(),
      operator: scoringData.operator || 'system',
      note: `从评分权重表导入，原始行号: ${scoringData.lineNumber}`,
      snapshot: { rawData: this._deepClone(clonedRaw) }
    });

    this._logAudit('add_scoring', recordId, scoringData.operator);
    return record;
  }

  applyManualChange(recordId, field, oldValue, newValue, operator, reason, nextHandler = null) {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    const actualOldValue = this._getNestedValue(record, field);
    const finalOldValue = oldValue !== undefined ? oldValue : actualOldValue;

    this._setNestedValue(record, field, newValue);

    const change = {
      field,
      oldValue: finalOldValue,
      newValue,
      operator,
      reason,
      nextHandler,
      timestamp: new Date().toISOString(),
      canRollback: true,
      previousValueSnapshot: this._deepClone(finalOldValue)
    };
    record.manualChanges.push(change);

    const beforeSnapshot = this._getCurrentDataSnapshot(record);
    record.auditTrail.push({
      action: 'manual_change_applied',
      timestamp: new Date().toISOString(),
      operator,
      note: `已修改 ${field}: ${JSON.stringify(finalOldValue)} → ${JSON.stringify(newValue)}`,
      detail: { field, oldValue: finalOldValue, newValue, reason, nextHandler },
      snapshot: beforeSnapshot
    });

    if (nextHandler) {
      record.nextHandler = nextHandler;
      record.currentStatus = 'pending_handler_review';
      record.auditTrail.push({
        action: 'handover_assigned',
        timestamp: new Date().toISOString(),
        operator,
        note: `下一步处理人: ${nextHandler}`,
        snapshot: this._getCurrentDataSnapshot(record)
      });
    } else {
      record.currentStatus = 'manually_updated';
    }

    record.lastModifiedAt = new Date().toISOString();
    record.lastModifiedBy = operator;

    this._logAudit('manual_change_applied', recordId, operator);
    return {
      record,
      changeIndex: record.manualChanges.length - 1
    };
  }

  rollbackChange(recordId, changeIndex, operator = 'system') {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    const change = record.manualChanges[changeIndex];
    if (!change || !change.canRollback) {
      throw new Error(`无法回滚该变更（索引:${changeIndex}）`);
    }

    this._setNestedValue(record, change.field, change.oldValue);

    change.canRollback = false;
    change.rolledBackAt = new Date().toISOString();
    change.rolledBackBy = operator;

    record.auditTrail.push({
      action: 'rollback_applied',
      timestamp: new Date().toISOString(),
      operator,
      note: `已回滚 ${change.field}: ${JSON.stringify(change.newValue)} → ${JSON.stringify(change.oldValue)}`,
      detail: { changeIndex, field: change.field, restoredValue: change.oldValue },
      snapshot: this._getCurrentDataSnapshot(record)
    });

    record.currentStatus = 'rolled_back';
    record.lastModifiedAt = new Date().toISOString();
    record.lastModifiedBy = operator;

    this._logAudit('rollback_applied', recordId, operator);
    return { change, record };
  }

  updateReviewStatus(recordId, status, reviewer, comment = '', nextHandler = null) {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    record.reviewStatus = status;
    record.reviewer = reviewer;
    record.reviewComment = comment;
    record.reviewedAt = new Date().toISOString();
    if (nextHandler) record.nextHandler = nextHandler;

    record.reviewTimeline.push({
      status,
      reviewer,
      comment,
      nextHandler,
      timestamp: new Date().toISOString(),
      dataSnapshot: this._getCurrentDataSnapshot(record)
    });

    record.auditTrail.push({
      action: 'review_status_updated',
      timestamp: new Date().toISOString(),
      operator: reviewer,
      note: `复核状态: ${status}, 备注: ${comment}${nextHandler ? `, 下一步: ${nextHandler}` : ''}`,
      detail: { status, comment, nextHandler },
      snapshot: this._getCurrentDataSnapshot(record)
    });

    if (status === 'approved') {
      record.currentStatus = 'review_approved';
    } else if (status === 'rejected') {
      record.currentStatus = 'review_rejected';
    } else if (status === 'needs_fix') {
      record.currentStatus = 'review_needs_fix';
    }

    this._logAudit('review_updated', recordId, reviewer);
    return record;
  }

  _getCurrentDataSnapshot(record) {
    return {
      boundaryRawData: record.boundaryEvidence ? this._deepClone(record.boundaryEvidence.rawData) : null,
      scoringRawData: record.scoringEvidence ? this._deepClone(record.scoringEvidence.rawData) : null,
      reviewStatus: record.reviewStatus,
      currentStatus: record.currentStatus,
      nextHandler: record.nextHandler
    };
  }

  getRecord(recordId) {
    return this.records.get(recordId);
  }

  getAllRecords() {
    return Array.from(this.records.values());
  }

  getRecordsByStatus(status) {
    return this.getAllRecords().filter(r => r.currentStatus === status);
  }

  getRecordsForReview() {
    return this.getAllRecords().filter(r => {
      if (!r.boundaryEvidence) return false;
      const raw = r.boundaryEvidence.rawData || {};
      return raw.denominator === '' || raw.denominator === 0;
    });
  }

  _logAudit(action, recordId, operator) {
    this.auditLog.push({
      action,
      recordId,
      operator,
      timestamp: new Date().toISOString()
    });
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  exportUnifiedResults() {
    return this.getAllRecords().map(record => ({
      recordId: record.recordId,
      boundaryEvidence: record.boundaryEvidence,
      scoringEvidence: record.scoringEvidence,
      reviewStatus: record.reviewStatus,
      reviewer: record.reviewer,
      reviewComment: record.reviewComment,
      reviewedAt: record.reviewedAt,
      reviewTimeline: record.reviewTimeline || [],
      currentStatus: record.currentStatus,
      manualChanges: record.manualChanges,
      auditTrail: record.auditTrail,
      nextHandler: record.nextHandler,
      lastModifiedAt: record.lastModifiedAt,
      lastModifiedBy: record.lastModifiedBy,
      _meta: {
        hasBothEvidence: !!(record.boundaryEvidence && record.scoringEvidence),
        needsReview: this._checkNeedsReview(record),
        changeCount: record.manualChanges.length,
        hasPendingRollbacks: record.manualChanges.some(c => c.canRollback),
        originalBoundaryValues: record.boundaryEvidence ? record.boundaryEvidence.originalRawData : null
      }
    }));
  }

  _checkNeedsReview(record) {
    if (!record.boundaryEvidence) return false;
    const raw = record.boundaryEvidence.rawData || {};
    return raw.denominator === '' || raw.denominator === 0;
  }

  getFullTraceability(recordId) {
    const record = this.records.get(recordId);
    if (!record) return null;

    const boundary = record.boundaryEvidence || {};
    const scoring = record.scoringEvidence || {};

    return {
      recordId,
      evidenceOrigin: {
        boundary: {
          source: '边界值说明',
          lineNumber: boundary.originalLineNumber,
          importTimestamp: boundary.importTimestamp,
          originalValues: boundary.originalRawData,
          currentValues: boundary.rawData
        },
        scoring: record.scoringEvidence ? {
          source: '评分权重表',
          lineNumber: scoring.originalLineNumber,
          importTimestamp: scoring.importTimestamp,
          originalValues: scoring.originalRawData,
          currentValues: scoring.rawData
        } : null
      },
      valueChanges: record.manualChanges.map((c, i) => ({
        index: i,
        field: c.field,
        original: c.oldValue,
        modified: c.newValue,
        reason: c.reason,
        operator: c.operator,
        nextHandler: c.nextHandler,
        timestamp: c.timestamp,
        canRollback: c.canRollback,
        rolledBackAt: c.rolledBackAt || null
      })),
      reviewHistory: record.reviewTimeline || [],
      auditTrail: record.auditTrail,
      summary: {
        totalChanges: record.manualChanges.length,
        pendingRollbacks: record.manualChanges.filter(c => c.canRollback).length,
        currentReviewStatus: record.reviewStatus,
        currentHandler: record.nextHandler,
        lastModifiedAt: record.lastModifiedAt
      }
    };
  }
}

module.exports = UnifiedEvidenceStore;

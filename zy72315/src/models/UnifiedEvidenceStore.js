class UnifiedEvidenceStore {
  constructor() {
    this.records = new Map();
    this.auditLog = [];
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
      reviewStatus: 'pending'
    };

    existing.boundaryEvidence = {
      ...boundaryData,
      originalLineNumber: boundaryData.lineNumber,
      importTimestamp: new Date().toISOString(),
      rawData: { ...boundaryData.rawData }
    };
    existing.currentStatus = 'boundary_imported';
    existing.auditTrail.push({
      action: 'boundary_imported',
      timestamp: new Date().toISOString(),
      operator: boundaryData.operator || 'system',
      note: `从边界值说明导入，原始行号: ${boundaryData.lineNumber}`
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

    record.scoringEvidence = {
      ...scoringData,
      originalLineNumber: scoringData.lineNumber,
      importTimestamp: new Date().toISOString(),
      rawData: { ...scoringData.rawData }
    };
    record.currentStatus = 'scoring_imported';
    record.auditTrail.push({
      action: 'scoring_imported',
      timestamp: new Date().toISOString(),
      operator: scoringData.operator || 'system',
      note: `从评分权重表导入，原始行号: ${scoringData.lineNumber}`
    });

    this._logAudit('add_scoring', recordId, scoringData.operator);
    return record;
  }

  applyManualChange(recordId, field, oldValue, newValue, operator, reason) {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    record.manualChanges.push({
      field,
      oldValue,
      newValue,
      operator,
      reason,
      timestamp: new Date().toISOString(),
      canRollback: true
    });
    record.auditTrail.push({
      action: 'manual_change',
      timestamp: new Date().toISOString(),
      operator,
      note: `${field}: ${oldValue} → ${newValue}, 原因: ${reason}`
    });

    this._logAudit('manual_change', recordId, operator);
    return record;
  }

  rollbackChange(recordId, changeIndex) {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    const change = record.manualChanges[changeIndex];
    if (!change || !change.canRollback) {
      throw new Error(`无法回滚该变更`);
    }

    change.canRollback = false;
    change.rolledBackAt = new Date().toISOString();
    record.auditTrail.push({
      action: 'rollback',
      timestamp: new Date().toISOString(),
      operator: 'system',
      note: `回滚变更: ${change.field}: ${change.newValue} → ${change.oldValue}`
    });

    this._logAudit('rollback', recordId, 'system');
    return change;
  }

  updateReviewStatus(recordId, status, reviewer, comment = '') {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    record.reviewStatus = status;
    record.reviewer = reviewer;
    record.reviewComment = comment;
    record.reviewedAt = new Date().toISOString();
    record.auditTrail.push({
      action: 'review',
      timestamp: new Date().toISOString(),
      operator: reviewer,
      note: `复核状态更新为 ${status}, 备注: ${comment}`
    });

    this._logAudit('review', recordId, reviewer);
    return record;
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
      currentStatus: record.currentStatus,
      manualChanges: record.manualChanges,
      auditTrail: record.auditTrail,
      _meta: {
        hasBothEvidence: !!(record.boundaryEvidence && record.scoringEvidence),
        needsReview: this._checkNeedsReview(record),
        changeCount: record.manualChanges.length
      }
    }));
  }

  _checkNeedsReview(record) {
    if (!record.boundaryEvidence) return false;
    const raw = record.boundaryEvidence.rawData || {};
    return raw.denominator === '' || raw.denominator === 0;
  }
}

module.exports = UnifiedEvidenceStore;

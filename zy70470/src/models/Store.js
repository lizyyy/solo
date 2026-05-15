const CircuitBreakerRecord = require('./CircuitBreakerRecord');

class Store {
  constructor() {
    this.records = new Map();
    this.initializeSampleData();
  }

  initializeSampleData() {
    const sampleRecords = require('../data/sample-data');
    sampleRecords.forEach(record => {
      const newRecord = new CircuitBreakerRecord(record);
      this.records.set(newRecord.id, newRecord);
    });
  }

  getAllRecords() {
    return Array.from(this.records.values()).map(r => r.toJSON());
  }

  getRecordById(id) {
    const record = this.records.get(id);
    return record ? record.toJSON() : null;
  }

  createRecord(data) {
    const record = new CircuitBreakerRecord(data);
    this.records.set(record.id, record);
    return record.toJSON();
  }

  updateRecord(id, data) {
    const record = this.records.get(id);
    if (!record) return null;
    
    Object.keys(data).forEach(key => {
      if (key !== 'id' && record[key] !== undefined) {
        record[key] = data[key];
      }
    });
    
    return record.toJSON();
  }

  addCandidateAction(recordId, action) {
    const record = this.records.get(recordId);
    if (!record) return null;
    record.addCandidateAction(action);
    return record.toJSON();
  }

  approveAction(recordId, actionId, approver, remark) {
    const record = this.records.get(recordId);
    if (!record) return null;
    record.approveAction(actionId, approver, remark);
    return record.toJSON();
  }

  addManualCorrection(recordId, correction) {
    const record = this.records.get(recordId);
    if (!record) return null;
    record.addManualCorrection(correction);
    return record.toJSON();
  }

  generateCandidateCleanupList(recordId) {
    const record = this.records.get(recordId);
    if (!record) return null;

    const affectedResources = record.affectedResources;
    const cleanupList = [];

    affectedResources.forEach(resource => {
      cleanupList.push({
        resourceId: resource.id,
        resourceName: resource.name,
        resourceType: resource.type,
        suggestedAction: this._determineAction(resource, record),
        riskScore: this._calculateRiskScore(resource),
        verificationRequired: this._needsVerification(resource),
        prerequisites: this._getPrerequisites(resource)
      });
    });

    return {
      recordId: recordId,
      generatedAt: new Date().toISOString(),
      totalItems: cleanupList.length,
      highRiskCount: cleanupList.filter(i => i.riskScore >= 8).length,
      items: cleanupList
    };
  }

  _determineAction(resource, record) {
    if (record.type === 'permission_escalation') {
      return resource.type === 'role' ? 'revoke_permissions' : 'audit_and_cleanup';
    } else if (record.type === 'grayscale_release') {
      return 'rollback_to_previous_version';
    }
    return 'review_manually';
  }

  _calculateRiskScore(resource) {
    let score = 5;
    if (resource.type === 'admin_role') score += 3;
    if (resource.environment === 'production') score += 2;
    if (resource.businessCritical) score += 2;
    return Math.min(score, 10);
  }

  _needsVerification(resource) {
    return resource.environment === 'production' || resource.businessCritical;
  }

  _getPrerequisites(resource) {
    const prereqs = [];
    if (resource.environment === 'production') {
      prereqs.push('backup_current_state');
      prereqs.push('notify_stakeholders');
    }
    if (resource.type === 'database') {
      prereqs.push('create_snapshot');
    }
    return prereqs;
  }

  deleteRecord(id) {
    return this.records.delete(id);
  }
}

module.exports = new Store();
class CircuitBreakerRecord {
  constructor(data) {
    this.id = data.id || `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.title = data.title;
    this.type = data.type;
    this.status = data.status || 'pending';
    this.severity = data.severity || 'medium';
    this.source = data.source;
    this.detectedAt = data.detectedAt || new Date().toISOString();
    this.description = data.description;
    this.affectedResources = data.affectedResources || [];
    this.candidateActions = data.candidateActions || [];
    this.approvedActions = data.approvedActions || [];
    this.manualCorrections = data.manualCorrections || [];
    this.fieldMetadata = data.fieldMetadata || {};
    this.createdBy = data.createdBy;
    this.assignedTo = data.assignedTo;
    this.tags = data.tags || [];
    this.comments = data.comments || [];
  }

  addCandidateAction(action) {
    this.candidateActions.push({
      id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: action.type,
      description: action.description,
      targetResources: action.targetResources,
      suggestedBy: action.suggestedBy,
      suggestedAt: new Date().toISOString(),
      riskLevel: action.riskLevel || 'medium',
      justification: action.justification
    });
  }

  approveAction(actionId, approver, remark) {
    const action = this.candidateActions.find(a => a.id === actionId);
    if (action) {
      action.approvedBy = approver;
      action.approvedAt = new Date().toISOString();
      action.approvalRemark = remark;
      action.status = 'approved';
      this.approvedActions.push(action);
    }
  }

  addManualCorrection(correction) {
    this.manualCorrections.push({
      id: `COR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      fieldPath: correction.fieldPath,
      oldValue: correction.oldValue,
      newValue: correction.newValue,
      correctedBy: correction.correctedBy,
      correctedAt: new Date().toISOString(),
      reason: correction.reason,
      sourceEvidence: correction.sourceEvidence
    });
    this.fieldMetadata[correction.fieldPath] = {
      source: correction.sourceEvidence,
      lastModified: new Date().toISOString(),
      modifiedBy: correction.correctedBy,
      justification: correction.reason
    };
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      type: this.type,
      status: this.status,
      severity: this.severity,
      source: this.source,
      detectedAt: this.detectedAt,
      description: this.description,
      affectedResources: this.affectedResources,
      candidateActions: this.candidateActions,
      approvedActions: this.approvedActions,
      manualCorrections: this.manualCorrections,
      fieldMetadata: this.fieldMetadata,
      createdBy: this.createdBy,
      assignedTo: this.assignedTo,
      tags: this.tags,
      comments: this.comments
    };
  }
}

module.exports = CircuitBreakerRecord;
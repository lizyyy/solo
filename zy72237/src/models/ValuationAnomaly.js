const { v4: uuidv4 } = require('uuid');

const STATUS = {
  PENDING_REVIEW: 'pending_review',
  CONFLICT: 'conflict',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  NORMAL: 'normal',
  AWAITING_RISK_REVIEW: 'awaiting_risk_review'
};

const SOURCE_TYPE = {
  EMAIL: 'email',
  BATCH: 'batch',
  MANUAL: 'manual'
};

class ValuationAnomaly {
  constructor(data) {
    this.id = uuidv4();
    this.recordId = data.recordId || uuidv4();
    this.securityCode = data.securityCode;
    this.securityName = data.securityName;
    this.marketValue = data.marketValue;
    this.calculatedValue = data.calculatedValue;
    this.deviation = data.deviation;
    this.deviationRate = data.deviationRate;
    this.status = STATUS.PENDING_REVIEW;
    this.remark = data.remark || '';
    this.isZeroWithReversal = data.marketValue === 0 && data.remark && data.remark.includes('已冲正');
    
    this.sources = [];
    this.conflicts = [];
    this.calculationParams = null;
    this.selfCheckResults = {};
    
    this.workflowStep = 1;
    this.workflowHistory = [];
    
    this.createdAt = new Date();
    this.updatedAt = new Date();
    
    if (data.source) {
      this.addSource(data.source);
    }
  }

  addSource(source) {
    const existingSource = this.sources.find(s => s.type === source.type);
    if (existingSource) {
      return { duplicate: true, existing: existingSource };
    }
    this.sources.push({
      ...source,
      importedAt: new Date()
    });
    this.updatedAt = new Date();
    return { duplicate: false };
  }

  setCalculationParams(params, version, rationale) {
    this.calculationParams = {
      params,
      version,
      rationale,
      calculatedAt: new Date()
    };
    this.updatedAt = new Date();
  }

  checkConflicts() {
    this.conflicts = [];
    
    const emailSource = this.sources.find(s => s.type === SOURCE_TYPE.EMAIL);
    const batchSource = this.sources.find(s => s.type === SOURCE_TYPE.BATCH);
    
    if (emailSource && batchSource) {
      if (emailSource.marketValue !== batchSource.marketValue) {
        this.conflicts.push({
          type: 'value_mismatch',
          field: 'marketValue',
          emailValue: emailSource.marketValue,
          batchValue: batchSource.marketValue,
          description: `邮件市值(${emailSource.marketValue})与批次市值(${batchSource.marketValue})不一致`
        });
      }
      
      if (emailSource.status !== batchSource.status) {
        this.conflicts.push({
          type: 'status_mismatch',
          field: 'status',
          emailValue: emailSource.status,
          batchValue: batchSource.status,
          description: `邮件状态(${emailSource.status})与批次状态(${batchSource.status})不一致`
        });
      }
    }
    
    if (this.conflicts.length > 0) {
      this.status = STATUS.CONFLICT;
    }
    
    return this.conflicts;
  }

  resolveConflict(conflictType, resolution, operator) {
    const conflict = this.conflicts.find(c => c.type === conflictType);
    if (conflict) {
      conflict.resolution = resolution;
      conflict.resolvedBy = operator;
      conflict.resolvedAt = new Date();
      conflict.decision = operator === 'confirm' ? '已确认' : '已驳回';
    }
    
    const unresolvedConflicts = this.conflicts.filter(c => !c.resolution);
    if (unresolvedConflicts.length === 0) {
      this.status = this.isZeroWithReversal ? STATUS.AWAITING_RISK_REVIEW : STATUS.PENDING_REVIEW;
    }
    
    this.workflowHistory.push({
      action: 'resolve_conflict',
      conflictType,
      resolution,
      operator,
      timestamp: new Date()
    });
    this.updatedAt = new Date();
  }

  advanceWorkflow(stepData, operator) {
    this.workflowHistory.push({
      action: `step_${this.workflowStep}`,
      data: stepData,
      operator,
      timestamp: new Date()
    });
    
    if (this.workflowStep < 3) {
      this.workflowStep++;
    }
    
    if (this.workflowStep === 3) {
      this.summary = stepData.summary;
    }
    
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      recordId: this.recordId,
      securityCode: this.securityCode,
      securityName: this.securityName,
      marketValue: this.marketValue,
      calculatedValue: this.calculatedValue,
      deviation: this.deviation,
      deviationRate: this.deviationRate,
      status: this.status,
      statusText: this.getStatusText(),
      remark: this.remark,
      isZeroWithReversal: this.isZeroWithReversal,
      sources: this.sources,
      conflicts: this.conflicts,
      calculationParams: this.calculationParams,
      selfCheckResults: this.selfCheckResults,
      workflowStep: this.workflowStep,
      workflowHistory: this.workflowHistory,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  getStatusText() {
    const statusMap = {
      [STATUS.PENDING_REVIEW]: '待审核',
      [STATUS.CONFLICT]: '存在冲突',
      [STATUS.CONFIRMED]: '已确认',
      [STATUS.REJECTED]: '已驳回',
      [STATUS.NORMAL]: '正常',
      [STATUS.AWAITING_RISK_REVIEW]: '待风控复核'
    };
    return statusMap[this.status] || this.status;
  }
}

module.exports = { ValuationAnomaly, STATUS, SOURCE_TYPE };

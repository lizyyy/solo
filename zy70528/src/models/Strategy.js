const { v4: uuidv4 } = require('uuid');
const { StrategyStatus, DegradationLevel } = require('./constants');

class Strategy {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.strategyName = data.strategyName;
    this.apiGroups = data.apiGroups || [];
    this.tenantScope = data.tenantScope || {
      type: 'all',
      tenants: []
    };
    this.degradationLevel = data.degradationLevel || DegradationLevel.L1;
    this.recoveryCondition = data.recoveryCondition || {
      type: 'manual',
      threshold: null
    };
    this.impactSummary = data.impactSummary || {
      totalApis: 0,
      affectedTenants: 0,
      estimatedRequests: 0,
      description: ''
    };
    this.status = data.status || StrategyStatus.PENDING;
    this.statusHistory = data.statusHistory || [{
      status: this.status,
      timestamp: new Date().toISOString(),
      operator: data.operator || 'system',
      reason: '策略创建'
    }];
    this.failurePath = data.failurePath || {
      originalInput: null,
      processingBasis: null,
      finalConclusion: null
    };
    this.impactRecords = data.impactRecords || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.publishedAt = data.publishedAt || null;
    this.operator = data.operator || 'system';
    this.remarks = data.remarks || '';
  }

  updateStatus(newStatus, operator, reason) {
    this.status = newStatus;
    this.statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      operator,
      reason
    });
    this.updatedAt = new Date().toISOString();
  }

  publish(operator) {
    this.publishedAt = new Date().toISOString();
    this.updateStatus(StrategyStatus.CONFIRMED, operator, '策略发布');
  }

  addImpactRecord(record) {
    this.impactRecords.push({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...record
    });
    this.updateImpactSummary();
  }

  updateImpactSummary() {
    const uniqueTenants = new Set();
    const uniqueApis = new Set();
    let totalRequests = 0;

    this.impactRecords.forEach(record => {
      if (record.tenantId) uniqueTenants.add(record.tenantId);
      if (record.apiPath) uniqueApis.add(record.apiPath);
      totalRequests += record.requestCount || 1;
    });

    this.impactSummary = {
      totalApis: uniqueApis.size,
      affectedTenants: uniqueTenants.size,
      estimatedRequests: totalRequests,
      description: this.impactSummary.description
    };
    this.updatedAt = new Date().toISOString();
  }

  setFailurePath(originalInput, processingBasis, finalConclusion) {
    this.failurePath = {
      originalInput,
      processingBasis,
      finalConclusion,
      timestamp: new Date().toISOString()
    };
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      strategyName: this.strategyName,
      apiGroups: this.apiGroups,
      tenantScope: this.tenantScope,
      degradationLevel: this.degradationLevel,
      recoveryCondition: this.recoveryCondition,
      impactSummary: this.impactSummary,
      status: this.status,
      statusHistory: this.statusHistory,
      failurePath: this.failurePath,
      impactRecords: this.impactRecords,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      operator: this.operator,
      remarks: this.remarks
    };
  }
}

module.exports = Strategy;

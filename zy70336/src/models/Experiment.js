const { v4: uuidv4 } = require('uuid');

class Experiment {
  constructor({
    id,
    name,
    endpoint,
    samplingRate,
    oldProcessor,
    newProcessor,
    ignoredFields = [],
    whitelistedDifferences = [],
    sideEffectFields = [],
    createdAt,
    status = 'active',
    pausedReason = null
  }) {
    this.id = id || uuidv4();
    this.name = name;
    this.endpoint = endpoint;
    this.samplingRate = samplingRate;
    this.oldProcessor = oldProcessor;
    this.newProcessor = newProcessor;
    this.ignoredFields = ignoredFields;
    this.whitelistedDifferences = whitelistedDifferences;
    this.sideEffectFields = sideEffectFields;
    this.createdAt = createdAt || new Date();
    this.status = status;
    this.pausedReason = pausedReason;
    this.totalRequests = 0;
    this.matchedRequests = 0;
    this.differences = [];
    this.sideEffectRisks = [];
  }

  pause(reason) {
    this.status = 'paused';
    this.pausedReason = reason;
  }

  resume() {
    this.status = 'active';
    this.pausedReason = null;
  }

  isActive() {
    return this.status === 'active';
  }

  shouldSample() {
    if (!this.isActive()) return false;
    return Math.random() < this.samplingRate;
  }

  addDifference(diff) {
    this.differences.push(diff);
  }

  addSideEffectRisk(risk) {
    this.sideEffectRisks.push(risk);
    this.pause(`检测到副作用风险: ${risk.field}`);
  }

  getStats() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      pausedReason: this.pausedReason,
      createdAt: this.createdAt,
      totalRequests: this.totalRequests,
      matchedRequests: this.matchedRequests,
      differenceCount: this.differences.length,
      sideEffectRiskCount: this.sideEffectRisks.length
    };
  }
}

module.exports = Experiment;

const { v4: uuidv4 } = require('uuid');

const TRIAL_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  CALCULATED: 'calculated',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

class TrialTask {
  constructor(data) {
    this.id = uuidv4();
    this.metricName = data.metricName;
    this.candidateThresholds = data.candidateThresholds;
    this.historySamples = data.historySamples;
    this.status = TRIAL_STATUS.PENDING;
    this.thresholdResults = [];
    this.falsePositiveRecords = [];
    this.report = null;
    this.originalInput = data;
    this.processingLogs = [];
    this.manualCorrections = [];
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.createdBy = data.createdBy || 'system';
  }

  updateStatus(status, logMessage) {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    if (logMessage) {
      this.processingLogs.push({
        timestamp: new Date().toISOString(),
        status,
        message: logMessage
      });
    }
  }

  addThresholdResult(result) {
    this.thresholdResults.push({
      id: uuidv4(),
      threshold: result.threshold,
      triggerCount: result.triggerCount,
      triggerRate: result.triggerRate,
      triggerPoints: result.triggerPoints,
      falsePositiveCount: 0,
      falsePositiveRate: 0,
      calculatedAt: new Date().toISOString()
    });
  }

  addFalsePositiveRecord(record) {
    this.falsePositiveRecords.push({
      id: uuidv4(),
      thresholdId: record.thresholdId,
      pointIndex: record.pointIndex,
      timestamp: record.timestamp,
      value: record.value,
      description: record.description,
      confirmed: false,
      createdAt: new Date().toISOString()
    });
  }

  addManualCorrection(correction) {
    this.manualCorrections.push({
      id: uuidv4(),
      field: correction.field,
      oldValue: correction.oldValue,
      newValue: correction.newValue,
      correctedBy: correction.correctedBy || 'anonymous',
      reason: correction.reason,
      correctedAt: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }

  generateReport() {
    const totalSamples = this.historySamples.length;
    const bestThreshold = this.thresholdResults.reduce((best, current) => {
      const bestBalance = best.triggerRate * 0.6 + (1 - best.falsePositiveRate) * 0.4;
      const currentBalance = current.triggerRate * 0.6 + (1 - current.falsePositiveRate) * 0.4;
      return currentBalance > bestBalance ? current : best;
    }, this.thresholdResults[0]);

    this.report = {
      id: uuidv4(),
      metricName: this.metricName,
      totalSamples,
      thresholdResults: this.thresholdResults,
      recommendedThreshold: bestThreshold ? bestThreshold.threshold : null,
      falsePositiveSummary: {
        total: this.falsePositiveRecords.length,
        byThreshold: this.thresholdResults.map(t => ({
          threshold: t.threshold,
          falsePositiveCount: t.falsePositiveCount
        }))
      },
      analysis: this._generateAnalysis(),
      generatedAt: new Date().toISOString()
    };

    return this.report;
  }

  _generateAnalysis() {
    const analyses = [];
    this.thresholdResults.forEach(result => {
      const rate = (result.triggerRate * 100).toFixed(2);
      analyses.push(`阈值 ${result.threshold}: 触发率 ${rate}%, 触发次数 ${result.triggerCount}`);
    });
    return analyses;
  }

  toJSON() {
    return {
      id: this.id,
      metricName: this.metricName,
      candidateThresholds: this.candidateThresholds,
      historySampleCount: this.historySamples.length,
      status: this.status,
      thresholdResults: this.thresholdResults,
      falsePositiveRecords: this.falsePositiveRecords,
      report: this.report,
      manualCorrections: this.manualCorrections,
      processingLogs: this.processingLogs,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { TrialTask, TRIAL_STATUS };
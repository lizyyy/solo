const eventStore = require('../models/EventStore');

class CorrectionService {
  constructor() {
    this.processingCorrections = new Set();
  }

  computeState(events) {
    const state = {};
    events.forEach(event => {
      Object.assign(state, event.payload);
    });
    return state;
  }

  async createCorrection(originalEventId, reason, correctedPayload, operator, metadata = {}) {
    const idempotencyKey = `${originalEventId}-${operator}-${JSON.stringify(correctedPayload)}`;
    
    if (this.processingCorrections.has(idempotencyKey)) {
      throw new Error('Correction already in progress for this event');
    }

    this.processingCorrections.add(idempotencyKey);

    try {
      const originalEvent = eventStore.getOriginalEvent(originalEventId);
      if (!originalEvent) {
        throw new Error('Original event not found');
      }

      if (originalEvent.isCorrected) {
        throw new Error('Event already corrected - cannot overwrite existing correction');
      }

      const correction = eventStore.createCorrectionEvent(
        originalEventId,
        reason,
        correctedPayload,
        operator,
        metadata
      );

      return correction;
    } finally {
      setTimeout(() => {
        this.processingCorrections.delete(idempotencyKey);
      }, 5000);
    }
  }

  async replayAndValidate(correctionId) {
    const correction = eventStore.getCorrectionEvent(correctionId);
    if (!correction) {
      throw new Error('Correction not found');
    }

    if (correction.status !== 'pending') {
      throw new Error('Correction already processed');
    }

    const allEvents = eventStore.getOriginalEvents(correction.aggregateId);
    const originalEvent = eventStore.getOriginalEvent(correction.originalEventId);

    const stateBefore = this.computeState(allEvents.filter(e => e.version < originalEvent.version));
    
    const eventsWithCorrection = allEvents.map(e => {
      if (e.id === correction.originalEventId) {
        return { ...e, payload: correction.correctedPayload };
      }
      return e;
    });

    const stateAfter = this.computeState(eventsWithCorrection);

    const anomalies = this.detectAnomalies(originalEvent, correction, stateBefore, stateAfter);
    const success = anomalies.filter(a => a.severity === 'error').length === 0;

    const details = {
      totalEvents: allEvents.length,
      correctedEventVersion: originalEvent.version,
      stateChange: {
        before: stateBefore,
        after: stateAfter
      },
      anomalies
    };

    const replayResult = eventStore.createReplayResult(
      correctionId,
      success,
      details,
      stateBefore,
      stateAfter
    );

    eventStore.updateCorrectionStatus(correctionId, success ? 'validated' : 'failed', {
      replayResultId: replayResult.id
    });

    return replayResult;
  }

  detectAnomalies(originalEvent, correction, stateBefore, stateAfter) {
    const anomalies = [];

    const originalKeys = Object.keys(correction.originalPayload);
    const correctedKeys = Object.keys(correction.correctedPayload);

    const missingKeys = originalKeys.filter(k => !correctedKeys.includes(k));
    if (missingKeys.length > 0) {
      anomalies.push({
        type: 'missing_fields',
        severity: 'warning',
        message: `Some fields from original payload are missing in correction: ${missingKeys.join(', ')}`,
        affectedFields: missingKeys
      });
    }

    const newKeys = correctedKeys.filter(k => !originalKeys.includes(k));
    if (newKeys.length > 0) {
      anomalies.push({
        type: 'new_fields',
        severity: 'info',
        message: `New fields added in correction: ${newKeys.join(', ')}`,
        affectedFields: newKeys
      });
    }

    if (!correction.reason || correction.reason.length < 10) {
      anomalies.push({
        type: 'insufficient_reason',
        severity: 'warning',
        message: 'Correction reason may be insufficient - please provide more details'
      });
    }

    const stateDiff = this.getStateDifference(stateBefore, stateAfter);
    if (Object.keys(stateDiff).length === 0) {
      anomalies.push({
        type: 'no_state_change',
        severity: 'warning',
        message: 'Correction does not result in any state change - may be redundant'
      });
    }

    return anomalies;
  }

  getStateDifference(before, after) {
    const diff = {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    allKeys.forEach(key => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        diff[key] = { before: before[key], after: after[key] };
      }
    });
    
    return diff;
  }

  async applyCorrection(correctionId, operator, manualOverride = false) {
    const correction = eventStore.getCorrectionEvent(correctionId);
    if (!correction) {
      throw new Error('Correction not found');
    }

    if (correction.status === 'applied') {
      throw new Error('Correction already applied - idempotent protection');
    }

    if (correction.status === 'failed' && !manualOverride) {
      throw new Error('Correction has validation failures - requires manual override');
    }

    if (!['validated', 'failed'].includes(correction.status)) {
      throw new Error('Correction must be validated before application');
    }

    const originalEvent = eventStore.getOriginalEvent(correction.originalEventId);
    
    eventStore.originalEvents[correction.originalEventId] = {
      ...originalEvent,
      isCorrected: true,
      correctionId: correctionId,
      correctedBy: operator,
      correctedAt: new Date().toISOString()
    };

    eventStore.updateCorrectionStatus(correctionId, 'applied', {
      appliedBy: operator,
      appliedAt: new Date().toISOString(),
      manualOverride
    });

    eventStore.saveData();

    return correction;
  }

  async generateReport(correctionId) {
    const correction = eventStore.getCorrectionEvent(correctionId);
    if (!correction) {
      throw new Error('Correction not found');
    }

    if (!correction.replayResultId) {
      throw new Error('No replay result found for correction');
    }

    const replayResult = eventStore.getReplayResult(correction.replayResultId);
    const originalEvent = eventStore.getOriginalEvent(correction.originalEventId);

    const summary = {
      correctionId: correction.id,
      originalEventId: correction.originalEventId,
      aggregateId: correction.aggregateId,
      operator: correction.operator,
      reason: correction.reason,
      status: correction.status,
      createdAt: correction.timestamp,
      replaySuccess: replayResult.success,
      totalAnomalies: replayResult.details.anomalies.length,
      anomalyBreakdown: replayResult.details.anomalies.reduce((acc, a) => {
        acc[a.severity] = (acc[a.severity] || 0) + 1;
        return acc;
      }, {})
    };

    const anomalyExplanations = replayResult.details.anomalies.map(anomaly => ({
      ...anomaly,
      explanation: this.explainAnomaly(anomaly)
    }));

    const report = eventStore.createCorrectionReport(
      correctionId,
      correction.replayResultId,
      summary,
      anomalyExplanations
    );

    return report;
  }

  explainAnomaly(anomaly) {
    const explanations = {
      missing_fields: 'This anomaly indicates that some fields present in the original event are not included in the corrected version. This may be intentional but should be verified.',
      new_fields: 'New fields have been added in the correction. This is allowed but may indicate a schema change that should be documented.',
      insufficient_reason: 'The correction reason appears to be brief. For audit purposes, consider providing more detailed justification for the change.',
      no_state_change: 'Applying this correction does not change the aggregate state. This may indicate the correction is redundant or the payload change is cosmetic only.'
    };
    return explanations[anomaly.type] || 'No specific explanation available for this anomaly type.';
  }

  async handleFailedCorrection(correctionId, rawInput, processingBasis, finalConclusion, operator) {
    const correction = eventStore.getCorrectionEvent(correctionId);
    if (!correction) {
      throw new Error('Correction not found');
    }

    if (!correction.replayResultId) {
      throw new Error('No replay result found');
    }

    eventStore.updateReplayResult(correction.replayResultId, {
      rawInput,
      processingBasis,
      finalConclusion,
      handledBy: operator,
      handledAt: new Date().toISOString()
    });

    eventStore.updateCorrectionStatus(correctionId, 'rejected', {
      rejectedBy: operator,
      rejectedAt: new Date().toISOString()
    });

    return correction;
  }

  async manualCorrection(correctionId, updatedPayload, reason, operator) {
    const correction = eventStore.getCorrectionEvent(correctionId);
    if (!correction) {
      throw new Error('Correction not found');
    }

    if (correction.status === 'applied') {
      throw new Error('Cannot modify an already applied correction');
    }

    correction.correctedPayload = updatedPayload;
    correction.manualOverrideReason = reason;
    correction.manualOverrideBy = operator;
    correction.status = 'pending';
    correction.manuallyUpdatedAt = new Date().toISOString();

    eventStore.saveData();

    return correction;
  }

  exportReport(reportId) {
    const report = eventStore.getCorrectionReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const correction = eventStore.getCorrectionEvent(report.correctionId);
    const replayResult = eventStore.getReplayResult(report.replayResultId);

    const exportData = {
      report,
      correction,
      replayResult,
      exportedAt: new Date().toISOString(),
      anomalySummary: this.generateAnomalySummary(report.anomalies)
    };

    eventStore.markReportExported(reportId);

    return exportData;
  }

  generateAnomalySummary(anomalies) {
    return anomalies.map(anomaly => ({
      type: anomaly.type,
      severity: anomaly.severity,
      message: anomaly.message,
      explanation: anomaly.explanation,
      recommendation: this.getRecommendation(anomaly)
    }));
  }

  getRecommendation(anomaly) {
    const recommendations = {
      missing_fields: 'Verify that field omission is intentional. If not, update the correction to include the missing fields.',
      new_fields: 'Document any schema changes and ensure downstream systems can handle the new fields.',
      insufficient_reason: 'Update the correction with a more detailed reason explaining why the change is necessary.',
      no_state_change: 'Consider canceling this correction as it does not affect the aggregate state.'
    };
    return recommendations[anomaly.type] || 'Review this anomaly and determine if any action is required.';
  }

  getCorrectionDetails(correctionId) {
    const correction = eventStore.getCorrectionEvent(correctionId);
    if (!correction) {
      return null;
    }

    const originalEvent = eventStore.getOriginalEvent(correction.originalEventId);
    const replayResult = correction.replayResultId 
      ? eventStore.getReplayResult(correction.replayResultId) 
      : null;

    return {
      correction,
      originalEvent,
      replayResult
    };
  }
}

module.exports = new CorrectionService();

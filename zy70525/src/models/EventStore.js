const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class EventStore {
  constructor() {
    this.dataPath = path.join(__dirname, '../../data');
    this.ensureDataDirectory();
    this.loadData();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  loadData() {
    const files = ['aggregates', 'originalEvents', 'correctionEvents', 'replayResults', 'correctionReports'];
    files.forEach(file => {
      const filePath = path.join(this.dataPath, `${file}.json`);
      if (fs.existsSync(filePath)) {
        try {
          this[file] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
          this[file] = {};
        }
      } else {
        this[file] = {};
      }
    });
  }

  saveData() {
    const files = ['aggregates', 'originalEvents', 'correctionEvents', 'replayResults', 'correctionReports'];
    files.forEach(file => {
      const filePath = path.join(this.dataPath, `${file}.json`);
      fs.writeFileSync(filePath, JSON.stringify(this[file], null, 2));
    });
  }

  createAggregate(aggregateType, aggregateId) {
    const id = aggregateId || uuidv4();
    this.aggregates[id] = {
      id,
      type: aggregateType,
      createdAt: new Date().toISOString(),
      version: 0,
      status: 'active'
    };
    this.saveData();
    return this.aggregates[id];
  }

  getAggregate(id) {
    return this.aggregates[id];
  }

  addOriginalEvent(aggregateId, eventType, payload, metadata = {}) {
    const eventId = uuidv4();
    const aggregate = this.aggregates[aggregateId];
    if (!aggregate) {
      throw new Error('Aggregate not found');
    }

    const event = {
      id: eventId,
      aggregateId,
      aggregateType: aggregate.type,
      eventType,
      payload,
      metadata,
      version: aggregate.version + 1,
      timestamp: new Date().toISOString(),
      isCorrected: false,
      correctionId: null
    };

    this.originalEvents[eventId] = event;
    aggregate.version++;
    this.saveData();
    return event;
  }

  getOriginalEvents(aggregateId) {
    return Object.values(this.originalEvents)
      .filter(e => e.aggregateId === aggregateId)
      .sort((a, b) => a.version - b.version);
  }

  getOriginalEvent(eventId) {
    return this.originalEvents[eventId];
  }

  createCorrectionEvent(originalEventId, reason, correctedPayload, operator, metadata = {}) {
    const originalEvent = this.originalEvents[originalEventId];
    if (!originalEvent) {
      throw new Error('Original event not found');
    }

    const existingCorrections = Object.values(this.correctionEvents).filter(
      c => c.originalEventId === originalEventId
    );
    if (existingCorrections.length > 0) {
      throw new Error('Event already has a correction - overwrite protection');
    }

    if (originalEvent.isCorrected) {
      throw new Error('Event already has an applied correction');
    }

    const correctionId = uuidv4();
    const correction = {
      id: correctionId,
      originalEventId,
      aggregateId: originalEvent.aggregateId,
      reason,
      originalPayload: JSON.parse(JSON.stringify(originalEvent.payload)),
      correctedPayload,
      operator,
      metadata,
      status: 'pending',
      timestamp: new Date().toISOString(),
      replayResultId: null,
      reportId: null
    };

    this.correctionEvents[correctionId] = correction;
    this.saveData();
    return correction;
  }

  getCorrectionEvent(correctionId) {
    return this.correctionEvents[correctionId];
  }

  getCorrectionsByAggregate(aggregateId) {
    return Object.values(this.correctionEvents)
      .filter(c => c.aggregateId === aggregateId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  updateCorrectionStatus(correctionId, status, additionalData = {}) {
    const correction = this.correctionEvents[correctionId];
    if (!correction) {
      throw new Error('Correction not found');
    }

    correction.status = status;
    correction.statusUpdatedAt = new Date().toISOString();
    Object.assign(correction, additionalData);
    this.saveData();
    return correction;
  }

  createReplayResult(correctionId, success, details, stateBefore, stateAfter) {
    const resultId = uuidv4();
    const result = {
      id: resultId,
      correctionId,
      success,
      details,
      stateBefore,
      stateAfter,
      timestamp: new Date().toISOString(),
      rawInput: null,
      processingBasis: null,
      finalConclusion: null
    };

    this.replayResults[resultId] = result;
    this.saveData();
    return result;
  }

  updateReplayResult(resultId, data) {
    const result = this.replayResults[resultId];
    if (!result) {
      throw new Error('Replay result not found');
    }
    Object.assign(result, data);
    this.saveData();
    return result;
  }

  getReplayResult(resultId) {
    return this.replayResults[resultId];
  }

  createCorrectionReport(correctionId, replayResultId, summary, anomalies) {
    const reportId = uuidv4();
    const report = {
      id: reportId,
      correctionId,
      replayResultId,
      summary,
      anomalies,
      generatedAt: new Date().toISOString(),
      exported: false,
      exportedAt: null
    };

    this.correctionReports[reportId] = report;
    this.saveData();
    return report;
  }

  getCorrectionReport(reportId) {
    return this.correctionReports[reportId];
  }

  getReportsByAggregate(aggregateId) {
    return Object.values(this.correctionReports)
      .filter(r => {
        const correction = this.correctionEvents[r.correctionId];
        return correction && correction.aggregateId === aggregateId;
      })
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
  }

  markReportExported(reportId) {
    const report = this.correctionReports[reportId];
    if (!report) {
      throw new Error('Report not found');
    }
    report.exported = true;
    report.exportedAt = new Date().toISOString();
    this.saveData();
    return report;
  }

  getAllCorrections(status = null) {
    let corrections = Object.values(this.correctionEvents);
    if (status) {
      corrections = corrections.filter(c => c.status === status);
    }
    return corrections.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getAllAggregates() {
    return Object.values(this.aggregates);
  }
}

module.exports = new EventStore();

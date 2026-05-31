const { v4: uuidv4 } = require('uuid');
const diff = require('diff');

class HistoryEntry {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.operation = data.operation;
    this.targetType = data.targetType;
    this.targetId = data.targetId;
    this.operator = data.operator || 'system';
    this.description = data.description || '';
    this.beforeState = data.beforeState || null;
    this.afterState = data.afterState || null;
    this.diff = data.diff || null;
    this.reason = data.reason || '';
  }

  static createDiff(before, after) {
    const beforeStr = JSON.stringify(before, null, 2);
    const afterStr = JSON.stringify(after, null, 2);
    const changes = diff.diffJson(beforeStr, afterStr);
    
    return changes.map(change => ({
      value: change.value,
      added: change.added || false,
      removed: change.removed || false,
      count: change.count
    }));
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      operation: this.operation,
      targetType: this.targetType,
      targetId: this.targetId,
      operator: this.operator,
      description: this.description,
      beforeState: this.beforeState,
      afterState: this.afterState,
      diff: this.diff,
      reason: this.reason
    };
  }
}

class History {
  constructor() {
    this.entries = [];
    this.sessionId = uuidv4();
  }

  load(data) {
    this.entries = (data.entries || []).map(e => new HistoryEntry(e));
    this.sessionId = data.sessionId || this.sessionId;
    return this;
  }

  record(operation, targetType, targetId, beforeState, afterState, operator, reason = '') {
    const entry = new HistoryEntry({
      operation,
      targetType,
      targetId,
      operator,
      beforeState,
      afterState,
      diff: HistoryEntry.createDiff(beforeState, afterState),
      reason
    });
    this.entries.push(entry);
    return entry;
  }

  findByTarget(targetType, targetId) {
    return this.entries
      .filter(e => e.targetType === targetType && e.targetId === targetId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  findByOperation(operation) {
    return this.entries
      .filter(e => e.operation === operation)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  findByTimeRange(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return this.entries
      .filter(e => {
        const t = new Date(e.timestamp);
        return t >= start && t <= end;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getLatest(count = 10) {
    return [...this.entries]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, count);
  }

  getScreenshotChanges() {
    return this.entries
      .filter(e => e.targetType === 'section' && e.description.includes('截图'))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getManualCorrections() {
    return this.entries
      .filter(e => e.operation === 'manual_correction')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      entries: this.entries.map(e => e.toJSON())
    };
  }
}

module.exports = { HistoryEntry, History };

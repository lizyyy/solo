const { v4: uuidv4 } = require('uuid');

class HistoryManager {
  constructor() {
    this.history = [];
    this._seq = 0;
  }

  createSnapshot(entity, operation, operator, changes = null, context = null) {
    const beforeData = changes ? this._deepClone(changes.before) : this._deepClone(entity);
    const afterData = changes ? this._deepClone(changes.after) : this._deepClone(entity);
    const seq = ++this._seq;

    const snapshot = {
      id: uuidv4(),
      seq,
      entityId: entity.id,
      entityType: entity.constructor.name,
      operation,
      operator,
      timestamp: new Date().toISOString(),
      before: beforeData,
      after: afterData,
      diff: this._calculateDiff(beforeData, afterData),
      context: context ? {
        originalValue: context.originalValue || null,
        changedValue: context.changedValue || null,
        reason: context.reason || null,
        nextStep: context.nextStep || null,
        reviewRequired: context.reviewRequired || false
      } : null
    };

    this.history.push(snapshot);
    return snapshot;
  }

  getHistory(entityId, limit = 10) {
    return this.history
      .filter(h => h.entityId === entityId)
      .sort((a, b) => b.seq - a.seq)
      .slice(0, limit);
  }

  getLatestSnapshot(entityId) {
    const records = this.history.filter(h => h.entityId === entityId);
    if (records.length === 0) return null;
    return records.reduce((latest, cur) => cur.seq > latest.seq ? cur : latest);
  }

  compareVersions(snapshotId1, snapshotId2) {
    const s1 = this.history.find(h => h.id === snapshotId1);
    const s2 = this.history.find(h => h.id === snapshotId2);
    if (!s1 || !s2) return null;
    return {
      snapshot1: s1,
      snapshot2: s2,
      diff: this._calculateDiff(s1.after, s2.after)
    };
  }

  rollback(snapshotId) {
    const snapshot = this.history.find(h => h.id === snapshotId);
    if (!snapshot) return null;
    return this._deepClone(snapshot.before);
  }

  getSnapshotById(snapshotId) {
    return this.history.find(h => h.id === snapshotId) || null;
  }

  _calculateDiff(obj1, obj2, prefix = '') {
    const diff = {};
    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      const val1 = obj1 ? obj1[key] : undefined;
      const val2 = obj2 ? obj2[key] : undefined;
      if (val1 !== null && val2 !== null && typeof val1 === 'object' && typeof val2 === 'object' && !Array.isArray(val1) && !Array.isArray(val2)) {
        const nestedDiff = this._calculateDiff(val1, val2, path);
        if (Object.keys(nestedDiff).length > 0) {
          Object.assign(diff, nestedDiff);
        }
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        diff[path] = { before: val1, after: val2 };
      }
    }
    return diff;
  }

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

module.exports = { HistoryManager };

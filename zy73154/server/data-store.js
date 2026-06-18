const { v4: uuidv4 } = require('uuid');

class ReportDataStore {
  constructor() {
    this.versions = [];
    this.latestVersion = null;
    this.pendingConfirmations = [];
  }

  createVersion(data, source, note = '') {
    const version = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source: source,
      note: note,
      records: JSON.parse(JSON.stringify(data.records || [])),
      boundarySamples: JSON.parse(JSON.stringify(data.boundarySamples || [])),
      verbalNotes: JSON.parse(JSON.stringify(data.verbalNotes || [])),
      stats: this.calculateStats(data),
      changes: this.calculateChanges(data)
    };
    this.versions.push(version);
    this.latestVersion = version;
    return version;
  }

  calculateStats(data) {
    const records = data.records || [];
    return {
      totalRecords: records.length,
      outliers: records.filter(r => r.isOutlier).length,
      pendingConfirm: records.filter(r => r.status === 'pending').length,
      normal: records.filter(r => r.status === 'normal').length,
      stationCount: [...new Set(records.map(r => r.stationId))].length
    };
  }

  calculateChanges(data) {
    if (!this.latestVersion) {
      return { type: 'initial', message: '初始导入', recordDiff: 0 };
    }
    const oldRecords = this.latestVersion.records || [];
    const newRecords = data.records || [];
    const diff = newRecords.length - oldRecords.length;
    const oldIds = new Set(oldRecords.map(r => r.id));
    const newIds = new Set(newRecords.map(r => r.id));
    const added = newRecords.filter(r => !oldIds.has(r.id)).length;
    const removed = oldRecords.filter(r => !newIds.has(r.id)).length;
    
    const modified = [];
    const oldMap = new Map(oldRecords.map(r => [r.id, r]));
    for (const nr of newRecords) {
      const or = oldMap.get(nr.id);
      if (or && JSON.stringify(or) !== JSON.stringify(nr)) {
        modified.push({
          id: nr.id,
          stationId: nr.stationId,
          changes: this.findDifferences(or, nr)
        });
      }
    }

    return {
      type: diff > 0 ? 'added' : diff < 0 ? 'removed' : 'modified',
      recordDiff: diff,
      addedCount: added,
      removedCount: removed,
      modifiedCount: modified.length,
      modifiedRecords: modified
    };
  }

  findDifferences(oldRec, newRec) {
    const changes = [];
    const keys = new Set([...Object.keys(oldRec), ...Object.keys(newRec)]);
    for (const key of keys) {
      if (JSON.stringify(oldRec[key]) !== JSON.stringify(newRec[key])) {
        changes.push({
          field: key,
          oldValue: oldRec[key],
          newValue: newRec[key]
        });
      }
    }
    return changes;
  }

  getVersion(versionId) {
    return this.versions.find(v => v.id === versionId) || null;
  }

  getAllVersions() {
    return this.versions.map(v => ({
      id: v.id,
      timestamp: v.timestamp,
      source: v.source,
      note: v.note,
      stats: v.stats,
      changes: v.changes
    }));
  }

  rollbackToVersion(versionId) {
    const version = this.getVersion(versionId);
    if (version) {
      this.latestVersion = version;
      return true;
    }
    return false;
  }
}

module.exports = ReportDataStore;

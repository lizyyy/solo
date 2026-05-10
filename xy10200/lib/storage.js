const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ContainerPosition, ShiftRecord, Conflict, CheckRecord } = require('./models');

class Storage {
  constructor(workspace) {
    this.workspace = workspace;
    this.dataDir = path.join(workspace, '.yardc');
    this.historyFile = path.join(this.dataDir, 'history.json');
    this.conflictsFile = path.join(this.dataDir, 'conflicts.json');
    this.checksumsFile = path.join(this.dataDir, 'checksums.json');
    
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.historyFile)) {
      fs.writeFileSync(this.historyFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(this.conflictsFile)) {
      fs.writeFileSync(this.conflictsFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(this.checksumsFile)) {
      fs.writeFileSync(this.checksumsFile, JSON.stringify([], null, 2));
    }
  }

  generateChecksum(positions, shifts) {
    const content = JSON.stringify({
      positions: positions.map(p => p.toJSON()),
      shifts: shifts.map(s => s.toJSON()),
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  isDuplicateCheck(checksum) {
    const checksums = this.loadChecksums();
    return checksums.includes(checksum);
  }

  loadChecksums() {
    const content = fs.readFileSync(this.checksumsFile, 'utf-8');
    return JSON.parse(content);
  }

  saveChecksum(checksum) {
    const checksums = this.loadChecksums();
    checksums.push(checksum);
    fs.writeFileSync(this.checksumsFile, JSON.stringify(checksums, null, 2));
  }

  loadHistory() {
    const content = fs.readFileSync(this.historyFile, 'utf-8');
    return JSON.parse(content);
  }

  saveCheckRecord(checkRecord) {
    const history = this.loadHistory();
    history.push(checkRecord.toJSON());
    fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
  }

  getLatestCheck() {
    const history = this.loadHistory();
    if (history.length === 0) return null;
    return history[history.length - 1];
  }

  getHistory(limit = 10) {
    const history = this.loadHistory();
    return history.slice(-limit).reverse();
  }

  loadConflicts() {
    const content = fs.readFileSync(this.conflictsFile, 'utf-8');
    return JSON.parse(content);
  }

  saveConflicts(conflicts) {
    const existing = this.loadConflicts();
    const existingIds = new Set(existing.map(c => c.id));
    
    for (const conflict of conflicts) {
      if (!existingIds.has(conflict.id)) {
        existing.push(conflict.toJSON());
      }
    }
    
    fs.writeFileSync(this.conflictsFile, JSON.stringify(existing, null, 2));
  }

  updateConflictStatus(conflictId, status, resolution = null) {
    const conflicts = this.loadConflicts();
    const conflict = conflicts.find(c => c.id === conflictId);
    
    if (conflict) {
      conflict.status = status;
      if (status === 'resolved') {
        conflict.resolvedAt = new Date().toISOString();
      }
      if (resolution) {
        conflict.resolution = resolution;
      }
      fs.writeFileSync(this.conflictsFile, JSON.stringify(conflicts, null, 2));
      return true;
    }
    return false;
  }

  getPendingConflicts() {
    const conflicts = this.loadConflicts();
    return conflicts.filter(c => c.status === 'pending');
  }

  getConflictsByType(type) {
    const conflicts = this.loadConflicts();
    return conflicts.filter(c => c.type === type);
  }

  getConflictById(id) {
    const conflicts = this.loadConflicts();
    return conflicts.find(c => c.id === id);
  }
}

module.exports = { Storage };

const fs = require('fs');
const path = require('path');

const STATE_DIR = '.pii-scan';
const STATE_FILE = 'scan-state.json';
const IGNORE_FILE = 'ignores.json';
const RESOLVED_FILE = 'resolved.json';

class StateManager {
  constructor(baseDir = process.cwd()) {
    this.baseDir = baseDir;
    this.stateDir = path.join(baseDir, STATE_DIR);
    this.statePath = path.join(this.stateDir, STATE_FILE);
    this.ignorePath = path.join(this.stateDir, IGNORE_FILE);
    this.resolvedPath = path.join(this.stateDir, RESOLVED_FILE);
    
    this._init();
  }
  
  _init() {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.statePath)) {
      this._writeState(this._getDefaultState());
    }
    
    if (!fs.existsSync(this.ignorePath)) {
      this._writeIgnores([]);
    }
    
    if (!fs.existsSync(this.resolvedPath)) {
      this._writeResolved([]);
    }
  }
  
  _getDefaultState() {
    return {
      lastScanTime: null,
      scannedFiles: {},
      scanResults: []
    };
  }
  
  _readState() {
    try {
      return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
    } catch {
      return this._getDefaultState();
    }
  }
  
  _writeState(state) {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }
  
  _readIgnores() {
    try {
      return JSON.parse(fs.readFileSync(this.ignorePath, 'utf8'));
    } catch {
      return [];
    }
  }
  
  _writeIgnores(ignores) {
    fs.writeFileSync(this.ignorePath, JSON.stringify(ignores, null, 2));
  }
  
  _readResolved() {
    try {
      return JSON.parse(fs.readFileSync(this.resolvedPath, 'utf8'));
    } catch {
      return [];
    }
  }
  
  _writeResolved(resolved) {
    fs.writeFileSync(this.resolvedPath, JSON.stringify(resolved, null, 2));
  }
  
  getActiveIgnoreIds() {
    const ignores = this._readIgnores();
    const now = Date.now();
    const activeIds = new Set();
    
    for (const ignore of ignores) {
      if (!ignore.expiresAt || ignore.expiresAt > now) {
        activeIds.add(ignore.matchId);
      }
    }
    
    return activeIds;
  }
  
  getResolvedIds() {
    const resolved = this._readResolved();
    return new Set(resolved.map(r => r.matchId));
  }
  
  addIgnore(matchId, reason, expiresInDays = 30) {
    const ignores = this._readIgnores();
    const now = Date.now();
    const expiresAt = expiresInDays ? now + (expiresInDays * 24 * 60 * 60 * 1000) : null;
    
    const existingIndex = ignores.findIndex(i => i.matchId === matchId);
    
    if (existingIndex >= 0) {
      ignores[existingIndex] = {
        ...ignores[existingIndex],
        reason,
        expiresAt,
        updatedAt: now,
        updatedBy: process.env.USER || 'unknown'
      };
    } else {
      ignores.push({
        matchId,
        reason,
        expiresAt,
        createdAt: now,
        createdBy: process.env.USER || 'unknown'
      });
    }
    
    this._writeIgnores(ignores);
  }
  
  removeIgnore(matchId) {
    const ignores = this._readIgnores();
    const filtered = ignores.filter(i => i.matchId !== matchId);
    this._writeIgnores(filtered);
  }
  
  markResolved(matchId) {
    const resolved = this._readResolved();
    const now = Date.now();
    
    if (!resolved.find(r => r.matchId === matchId)) {
      resolved.push({
        matchId,
        resolvedAt: now,
        resolvedBy: process.env.USER || 'unknown'
      });
      this._writeResolved(resolved);
    }
  }
  
  getLastScanInfo() {
    const state = this._readState();
    return {
      lastScanTime: state.lastScanTime,
      filesScanned: Object.keys(state.scannedFiles).length,
      totalMatches: state.scanResults.reduce((sum, r) => sum + r.matches.length, 0)
    };
  }
  
  getFilesNeedingScan(filePaths) {
    const state = this._readState();
    const needsScan = [];
    
    for (const filePath of filePaths) {
      const fileStat = fs.statSync(filePath);
      const lastScan = state.scannedFiles[filePath];
      
      if (!lastScan || lastScan.mtime < fileStat.mtimeMs) {
        needsScan.push(filePath);
      }
    }
    
    return needsScan;
  }
  
  saveScanResults(results) {
    const state = this._readState();
    const now = Date.now();
    
    const scannedFiles = { ...state.scannedFiles };
    
    for (const result of results) {
      try {
        const stat = fs.statSync(result.filePath);
        scannedFiles[result.filePath] = {
          mtime: stat.mtimeMs,
          lastScanned: now
        };
      } catch {
        continue;
      }
    }
    
    this._writeState({
      lastScanTime: now,
      scannedFiles,
      scanResults: results
    });
  }
  
  getScanResults() {
    const state = this._readState();
    return state.scanResults;
  }
  
  getExpiredIgnores() {
    const ignores = this._readIgnores();
    const now = Date.now();
    
    return ignores.filter(i => i.expiresAt && i.expiresAt <= now);
  }
  
  getAllIgnores() {
    return this._readIgnores();
  }
  
  getAllResolved() {
    return this._readResolved();
  }
  
  clearState() {
    this._writeState(this._getDefaultState());
  }
  
  clearAll() {
    if (fs.existsSync(this.stateDir)) {
      fs.rmSync(this.stateDir, { recursive: true, force: true });
    }
    this._init();
  }
}

module.exports = StateManager;

const fs = require('fs');
const path = require('path');

class MessageStore {
  constructor(storagePath = './data') {
    this.storagePath = storagePath;
    this.resultsFile = path.join(storagePath, 'results.json');
    this.ensureStorageExists();
  }

  ensureStorageExists() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    if (!fs.existsSync(this.resultsFile)) {
      fs.writeFileSync(this.resultsFile, JSON.stringify({}, null, 2));
    }
  }

  generateMessageHash(message) {
    const { sign, ...data } = message;
    return JSON.stringify(data);
  }

  saveResult(message, result, batchId, timestamp) {
    const results = this.loadResults();
    const messageHash = this.generateMessageHash(message);
    
    if (!results[batchId]) {
      results[batchId] = {};
    }
    
    results[batchId][messageHash] = {
      message,
      result,
      timestamp
    };
    
    fs.writeFileSync(this.resultsFile, JSON.stringify(results, null, 2));
  }

  loadResults() {
    try {
      const data = fs.readFileSync(this.resultsFile, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }

  findExistingResult(message, batchId) {
    const results = this.loadResults();
    const messageHash = this.generateMessageHash(message);
    
    if (results[batchId] && results[batchId][messageHash]) {
      return results[batchId][messageHash];
    }
    
    for (const id in results) {
      if (results[id][messageHash]) {
        return {
          ...results[id][messageHash],
          differentBatch: true,
          previousBatchId: id
        };
      }
    }
    
    return null;
  }

  checkConflict(message, batchId, newResult) {
    const existing = this.findExistingResult(message, batchId);
    if (!existing) {
      return { hasConflict: false };
    }
    
    const hasConflict = existing.result.valid !== newResult.valid;
    
    return {
      hasConflict,
      existing,
      newResult
    };
  }

  getBatchResults(batchId) {
    const results = this.loadResults();
    return results[batchId] || {};
  }

  getAllBatches() {
    const results = this.loadResults();
    return Object.keys(results);
  }

  exportBatch(batchId, exportPath) {
    const batchResults = this.getBatchResults(batchId);
    const exportData = {
      batchId,
      exportTime: new Date().toISOString(),
      records: Object.values(batchResults)
    };
    
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    return exportPath;
  }
}

module.exports = MessageStore;
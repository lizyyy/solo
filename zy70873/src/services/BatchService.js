const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class BatchService {
  constructor() {
    this.processedBatches = new Map();
    this.storagePath = path.join(config.dataDir, 'batches.json');
    this.loadStoredBatches();
  }

  loadStoredBatches() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        const batches = JSON.parse(data);
        for (const batch of batches) {
          this.processedBatches.set(batch.batchId, batch);
        }
      }
    } catch (error) {
      console.warn('加载批次历史失败，使用空记录:', error.message);
    }
  }

  saveBatches() {
    try {
      const batches = Array.from(this.processedBatches.values());
      if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(batches, null, 2));
    } catch (error) {
      console.error('保存批次记录失败:', error.message);
    }
  }

  generateBatchId(files, additionalData = '') {
    const fileInfo = files
      .map(f => `${f.originalname}_${f.size}_${path.basename(f.path)}`)
      .sort()
      .join('|');
    
    const hash = crypto
      .createHash('md5')
      .update(fileInfo + additionalData)
      .digest('hex');
    
    return `BATCH_${Date.now()}_${hash.substring(0, 8)}`;
  }

  isBatchProcessed(batchHash) {
    for (const batch of this.processedBatches.values()) {
      if (batch.contentHash === batchHash) {
        return batch;
      }
    }
    return null;
  }

  generateContentHash(showtimes, boxOffices, contractRules) {
    const content = JSON.stringify({
      showtimes: showtimes.map(s => ({ ...s, batchId: null, sourceFile: null, lineNumber: null })),
      boxOffices: boxOffices.map(b => ({ ...b, batchId: null, sourceFile: null, lineNumber: null })),
      contractRules: contractRules.map(r => ({ ...r, batchId: null, sourceFile: null, lineNumber: null }))
    });
    
    return crypto.createHash('md5').update(content).digest('hex');
  }

  registerBatch(batchId, showtimes, boxOffices, contractRules, result) {
    const contentHash = this.generateContentHash(showtimes, boxOffices, contractRules);
    
    const batchRecord = {
      batchId,
      contentHash,
      processedAt: new Date().toISOString(),
      showtimeCount: showtimes.length,
      boxOfficeCount: boxOffices.length,
      ruleCount: contractRules.length,
      resultSummary: result.toSummaryJSON(),
      resultId: result.id
    };
    
    this.processedBatches.set(batchId, batchRecord);
    this.saveBatches();
    
    return batchRecord;
  }

  checkDuplicate(showtimes, boxOffices, contractRules) {
    const contentHash = this.generateContentHash(showtimes, boxOffices, contractRules);
    const existingBatch = this.isBatchProcessed(contentHash);
    
    if (existingBatch) {
      return {
        isDuplicate: true,
        existingBatch: existingBatch,
        message: `该批次数据已在 ${existingBatch.processedAt} 处理过，批次ID: ${existingBatch.batchId}`
      };
    }
    
    return { isDuplicate: false };
  }

  getBatch(batchId) {
    return this.processedBatches.get(batchId) || null;
  }

  getAllBatches() {
    return Array.from(this.processedBatches.values());
  }

  getBatchResultFilePath(batchId) {
    return path.join(config.dataDir, `result_${batchId}.json`);
  }

  saveBatchResult(batchId, result) {
    const filePath = this.getBatchResultFilePath(batchId);
    try {
      if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(result.toJSON(), null, 2));
      return filePath;
    } catch (error) {
      console.error('保存核算结果失败:', error.message);
      return null;
    }
  }

  loadBatchResult(batchId) {
    const filePath = this.getBatchResultFilePath(batchId);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('加载核算结果失败:', error.message);
    }
    return null;
  }

  getTraceItem(batchId, traceId) {
    const result = this.loadBatchResult(batchId);
    if (!result) return null;

    const allItems = [
      ...(result.normalItems || []),
      ...(result.pendingItems || []),
      ...(result.failedItems || [])
    ];

    return allItems.find(item => item.traceId === traceId) || null;
  }
}

module.exports = new BatchService();

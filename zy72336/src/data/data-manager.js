const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const _ = require('lodash');

const RECORD_STATUS = {
  PENDING_REVIEW: 'pending_review',
  MANUAL_CONFIRMED: 'manual_confirmed',
  AUTO_PROCESSED: 'auto_processed',
  EXCLUDED: 'excluded',
  BOUNDARY_CASE: 'boundary_case'
};

const DATA_ISSUE_TYPES = {
  NEGATIVE_VALUE: 'negative_value',
  MISSING_VALUE: 'missing_value',
  DUPLICATE: 'duplicate',
  OUTLIER: 'outlier',
  MANUAL_CHANGED: 'manual_changed'
};

class DataManager {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDirectories();
    
    this.rawRecords = [];
    this.processedRecords = [];
    this.importHistory = [];
    this.manualEdits = [];
    this.dataIssues = [];
    this.calculationResults = null;
  }

  ensureDataDirectories() {
    const dirs = [
      this.dataDir,
      path.join(this.dataDir, 'raw'),
      path.join(this.dataDir, 'processed'),
      path.join(this.dataDir, 'exports'),
      path.join(this.dataDir, 'audit')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async importCSV(filePath, sourceName = 'unknown') {
    const fileHash = this.getFileHash(filePath);
    const importCheck = this.checkDuplicateImport(filePath, fileHash);
    
    if (importCheck.isDuplicate) {
      return {
        success: false,
        reason: 'duplicate_import',
        message: `文件已在 ${importCheck.existingImport.timestamp} 导入过`,
        existingImport: importCheck.existingImport
      };
    }

    const records = await this.parseCSV(filePath);
    const importId = this.generateImportId();
    const timestamp = new Date().toISOString();

    records.forEach((record, index) => {
      const rawRecord = {
        ...record,
        _meta: {
          importId,
          sourceName,
          originalLineNumber: index + 2,
          filePath,
          fileHash,
          importTimestamp: timestamp,
          status: RECORD_STATUS.AUTO_PROCESSED,
          issues: [],
          manualEdits: []
        }
      };

      this.detectIssues(rawRecord);
      this.rawRecords.push(rawRecord);
    });

    this.importHistory.push({
      importId,
      sourceName,
      filePath,
      fileHash,
      timestamp,
      recordCount: records.length,
      issueCount: this.dataIssues.filter(i => i.importId === importId).length
    });

    this.saveAuditLog('import', { importId, sourceName, recordCount: records.length });

    return {
      success: true,
      importId,
      recordCount: records.length,
      issues: this.dataIssues.filter(i => i.importId === importId)
    };
  }

  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const records = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  getFileHash(filePath) {
    const stats = fs.statSync(filePath);
    return `${stats.size}-${stats.mtimeMs}`;
  }

  checkDuplicateImport(filePath, fileHash) {
    const existingImport = this.importHistory.find(
      h => h.filePath === filePath || h.fileHash === fileHash
    );
    
    return {
      isDuplicate: !!existingImport,
      existingImport
    };
  }

  generateImportId() {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  detectIssues(record) {
    const issues = [];
    const valueFields = ['flow', 'count', 'value', 'amount', 'number'];
    
    for (const field of Object.keys(record)) {
      if (field.startsWith('_')) continue;
      
      const value = record[field];
      const fieldLower = field.toLowerCase();
      
      if (value === '' || value === null || value === undefined) {
        issues.push({
          type: DATA_ISSUE_TYPES.MISSING_VALUE,
          field,
          value,
          severity: 'medium',
          message: `${field} 字段为空，旧表会当成缺失值`
        });
        record._meta.status = RECORD_STATUS.BOUNDARY_CASE;
      }
      
      if (valueFields.some(vf => fieldLower.includes(vf))) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue < 0) {
          issues.push({
            type: DATA_ISSUE_TYPES.NEGATIVE_VALUE,
            field,
            value: numValue,
            severity: 'high',
            message: `${field} 为负数 (${numValue})，旧表当成缺失，需人工复核`
          });
          record._meta.status = RECORD_STATUS.PENDING_REVIEW;
        }
      }
    }

    if (this.isDuplicateRecord(record)) {
      issues.push({
        type: DATA_ISSUE_TYPES.DUPLICATE,
        severity: 'low',
        message: '该记录与已有记录重复'
      });
    }

    record._meta.issues = issues;
    issues.forEach(issue => {
      this.dataIssues.push({
        ...issue,
        importId: record._meta.importId,
        originalLineNumber: record._meta.originalLineNumber,
        recordId: this.rawRecords.length
      });
    });
  }

  isDuplicateRecord(record) {
    const keyFields = ['id', 'timestamp', 'time', 'date'];
    const recordKeys = Object.keys(record).filter(k => keyFields.includes(k.toLowerCase()));
    
    if (recordKeys.length === 0) return false;
    
    return this.rawRecords.some(existing => {
      return recordKeys.every(key => existing[key] === record[key]);
    });
  }

  applyManualEdit(recordIndex, field, newValue, reason, operator) {
    const record = this.rawRecords[recordIndex];
    if (!record) {
      throw new Error(`记录 ${recordIndex} 不存在`);
    }

    const oldValue = record[field];
    const edit = {
      recordIndex,
      originalLineNumber: record._meta.originalLineNumber,
      field,
      oldValue,
      newValue,
      reason,
      operator,
      timestamp: new Date().toISOString()
    };

    record[field] = newValue;
    record._meta.manualEdits.push(edit);
    record._meta.status = RECORD_STATUS.MANUAL_CONFIRMED;
    this.manualEdits.push(edit);

    this.saveAuditLog('manual_edit', edit);

    return edit;
  }

  getBoundaryCases() {
    return this.rawRecords.filter(
      r => r._meta.status === RECORD_STATUS.PENDING_REVIEW || 
           r._meta.status === RECORD_STATUS.BOUNDARY_CASE
    );
  }

  getNegativeSamples() {
    return this.rawRecords.filter(r => 
      r._meta.issues.some(i => i.type === DATA_ISSUE_TYPES.NEGATIVE_VALUE)
    );
  }

  getManualCalculationExamples() {
    return this.rawRecords.filter(r => 
      r._meta.manualEdits.length > 0 || 
      r._meta.status === RECORD_STATUS.MANUAL_CONFIRMED ||
      r._meta.issues.length > 0
    ).map(r => ({
      originalLineNumber: r._meta.originalLineNumber,
      currentStatus: r._meta.status,
      issues: r._meta.issues,
      manualEdits: r._meta.manualEdits,
      rawData: _.omit(r, '_meta')
    }));
  }

  saveAuditLog(action, details) {
    const logPath = path.join(this.dataDir, 'audit', 'audit-log.jsonl');
    const logEntry = JSON.stringify({
      action,
      timestamp: new Date().toISOString(),
      ...details
    }) + '\n';
    fs.appendFileSync(logPath, logEntry);
  }

  getUnifiedResults() {
    return {
      rawRecords: this.rawRecords,
      boundaryCases: this.getBoundaryCases(),
      negativeSamples: this.getNegativeSamples(),
      manualCalculationExamples: this.getManualCalculationExamples(),
      importHistory: this.importHistory,
      manualEdits: this.manualEdits,
      dataIssues: this.dataIssues,
      calculationResults: this.calculationResults,
      summary: {
        totalRecords: this.rawRecords.length,
        boundaryCaseCount: this.getBoundaryCases().length,
        negativeSampleCount: this.getNegativeSamples().length,
        manualEditCount: this.manualEdits.length,
        importCount: this.importHistory.length
      }
    };
  }

  setCalculationResults(results) {
    this.calculationResults = results;
  }
}

module.exports = {
  DataManager,
  RECORD_STATUS,
  DATA_ISSUE_TYPES
};

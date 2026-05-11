const crypto = require('crypto');

class ImportHistory {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.batchId = data.batchId || this.generateBatchId();
    this.fileName = data.fileName || '';
    this.fileHash = data.fileHash || '';
    this.importType = data.importType || '';
    this.importDate = data.importDate || new Date().toISOString();
    this.recordCount = data.recordCount || 0;
    this.successCount = data.successCount || 0;
    this.errorCount = data.errorCount || 0;
    this.status = data.status || 'pending';
    this.errors = data.errors || [];
    this.importedKeys = data.importedKeys || [];
    this.notes = data.notes || '';
  }

  generateId() {
    return `IM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateBatchId() {
    return `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  static computeFileHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  toJSON() {
    return {
      id: this.id,
      batchId: this.batchId,
      fileName: this.fileName,
      fileHash: this.fileHash,
      importType: this.importType,
      importDate: this.importDate,
      recordCount: this.recordCount,
      successCount: this.successCount,
      errorCount: this.errorCount,
      status: this.status,
      errors: this.errors,
      importedKeys: this.importedKeys,
      notes: this.notes
    };
  }
}

module.exports = ImportHistory;

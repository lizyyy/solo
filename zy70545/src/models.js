const { v4: uuidv4 } = require('uuid');

const ImportStatus = {
  CREATED: 'CREATED',
  PROCESSING: 'PROCESSING',
  VALIDATING: 'VALIDATING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  CONFLICT: 'CONFLICT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

const ConflictType = {
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_PHONE: 'DUPLICATE_PHONE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  DATA_MISMATCH: 'DATA_MISMATCH',
  MANUAL_REVIEW: 'MANUAL_REVIEW'
};

class ImportBatch {
  constructor({ operator, source, fileName, fileHash, totalRows, metadata = {} }) {
    this.id = uuidv4();
    this.operator = operator;
    this.source = source;
    this.fileName = fileName;
    this.fileHash = fileHash;
    this.totalRows = totalRows;
    this.status = ImportStatus.CREATED;
    this.metadata = metadata;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.statusHistory = [{
      status: ImportStatus.CREATED,
      timestamp: this.createdAt,
      operator: operator,
      note: '批次创建'
    }];
  }

  updateStatus(status, operator, note = '') {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    this.statusHistory.push({
      status,
      timestamp: this.updatedAt,
      operator,
      note
    });
  }
}

class OriginalRow {
  constructor({ batchId, rowNumber, rawData, checksum }) {
    this.id = uuidv4();
    this.batchId = batchId;
    this.rowNumber = rowNumber;
    this.rawData = rawData;
    this.checksum = checksum;
    this.status = 'PENDING';
    this.createdAt = new Date().toISOString();
  }
}

class CorrectionRecord {
  constructor({ rowId, fieldName, oldValue, newValue, operator, reason, source = 'MANUAL' }) {
    this.id = uuidv4();
    this.rowId = rowId;
    this.fieldName = fieldName;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.operator = operator;
    this.reason = reason;
    this.source = source;
    this.timestamp = new Date().toISOString();
  }
}

class ConflictRecord {
  constructor({ rowId, type, fieldName, currentValue, newValue, message, resolution = 'PENDING' }) {
    this.id = uuidv4();
    this.rowId = rowId;
    this.type = type;
    this.fieldName = fieldName;
    this.currentValue = currentValue;
    this.newValue = newValue;
    this.message = message;
    this.resolution = resolution;
    this.resolvedBy = null;
    this.resolvedAt = null;
    this.createdAt = new Date().toISOString();
  }

  resolve(resolution, operator) {
    this.resolution = resolution;
    this.resolvedBy = operator;
    this.resolvedAt = new Date().toISOString();
  }
}

class ProcessedRow {
  constructor({ rowId, finalData, success, errors = [] }) {
    this.id = uuidv4();
    this.rowId = rowId;
    this.finalData = finalData;
    this.success = success;
    this.errors = errors;
    this.createdAt = new Date().toISOString();
  }
}

module.exports = {
  ImportStatus,
  ConflictType,
  ImportBatch,
  OriginalRow,
  CorrectionRecord,
  ConflictRecord,
  ProcessedRow
};

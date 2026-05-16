const { v4: uuidv4 } = require('uuid');

const FILE_STATUS = {
  UPLOADED: 'uploaded',
  PARSING: 'parsing',
  PARSED: 'parsed',
  FAILED: 'failed',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  REJECTED: 'rejected'
};

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

class UploadFile {
  constructor({ filename, originalName, mimeType, size, uploadedBy }) {
    this.id = uuidv4();
    this.filename = filename;
    this.originalName = originalName;
    this.mimeType = mimeType;
    this.size = size;
    this.uploadedBy = uploadedBy;
    this.status = FILE_STATUS.UPLOADED;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isSandbox = true;
  }

  updateStatus(status) {
    this.status = status;
    this.updatedAt = new Date();
  }
}

class SandboxTask {
  constructor({ fileId, ruleId, triggeredBy }) {
    this.id = uuidv4();
    this.fileId = fileId;
    this.ruleId = ruleId;
    this.triggeredBy = triggeredBy;
    this.status = TASK_STATUS.PENDING;
    this.progress = 0;
    this.totalRows = 0;
    this.successRows = 0;
    this.failedRows = 0;
    this.startedAt = null;
    this.completedAt = null;
    this.error = null;
    this.createdAt = new Date();
  }

  start(totalRows) {
    this.status = TASK_STATUS.RUNNING;
    this.startedAt = new Date();
    this.totalRows = totalRows;
  }

  updateProgress(success, failed) {
    this.successRows = success;
    this.failedRows = failed;
    this.progress = Math.round(((success + failed) / this.totalRows) * 100);
  }

  complete() {
    this.status = TASK_STATUS.COMPLETED;
    this.completedAt = new Date();
    this.progress = 100;
  }

  fail(error) {
    this.status = TASK_STATUS.FAILED;
    this.completedAt = new Date();
    this.error = error;
  }
}

class ParseRule {
  constructor({ name, description, columns, validators, createdBy }) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.columns = columns;
    this.validators = validators;
    this.createdBy = createdBy;
    this.createdAt = new Date();
    this.isActive = true;
  }
}

class FailedRow {
  constructor({ taskId, fileId, rowNumber, originalData, validationErrors, processingBasis, conclusion }) {
    this.id = uuidv4();
    this.taskId = taskId;
    this.fileId = fileId;
    this.rowNumber = rowNumber;
    this.originalData = originalData;
    this.validationErrors = validationErrors;
    this.processingBasis = processingBasis;
    this.conclusion = conclusion || 'validation_failed';
    this.isManuallyFixed = false;
    this.fixedData = null;
    this.fixedBy = null;
    this.fixedAt = null;
    this.createdAt = new Date();
  }

  manuallyFix(fixedData, fixedBy) {
    this.fixedData = fixedData;
    this.fixedBy = fixedBy;
    this.fixedAt = new Date();
    this.isManuallyFixed = true;
  }
}

class PublishRequest {
  constructor({ fileId, taskId, requestedBy, reason }) {
    this.id = uuidv4();
    this.fileId = fileId;
    this.taskId = taskId;
    this.requestedBy = requestedBy;
    this.reason = reason;
    this.status = APPROVAL_STATUS.PENDING;
    this.reviewedBy = null;
    this.reviewComment = null;
    this.reviewedAt = null;
    this.createdAt = new Date();
  }

  approve(reviewedBy, comment) {
    this.status = APPROVAL_STATUS.APPROVED;
    this.reviewedBy = reviewedBy;
    this.reviewComment = comment;
    this.reviewedAt = new Date();
  }

  reject(reviewedBy, comment) {
    this.status = APPROVAL_STATUS.REJECTED;
    this.reviewedBy = reviewedBy;
    this.reviewComment = comment;
    this.reviewedAt = new Date();
  }
}

class ParseSummary {
  constructor({ fileId, taskId, ruleId }) {
    this.id = uuidv4();
    this.fileId = fileId;
    this.taskId = taskId;
    this.ruleId = ruleId;
    this.totalRows = 0;
    this.successRows = 0;
    this.failedRows = 0;
    this.errorBreakdown = {};
    this.columnBreakdown = {};
    this.sampleFailedRows = [];
    this.generatedAt = new Date();
  }

  addError(type, message) {
    if (!this.errorBreakdown[type]) {
      this.errorBreakdown[type] = { count: 0, examples: [] };
    }
    this.errorBreakdown[type].count++;
    if (this.errorBreakdown[type].examples.length < 5) {
      this.errorBreakdown[type].examples.push(message);
    }
  }

  addColumnError(column, message) {
    if (!this.columnBreakdown[column]) {
      this.columnBreakdown[column] = { count: 0, examples: [] };
    }
    this.columnBreakdown[column].count++;
    if (this.columnBreakdown[column].examples.length < 3) {
      this.columnBreakdown[column].examples.push(message);
    }
  }

  addSampleFailedRow(failedRow) {
    if (this.sampleFailedRows.length < 10) {
      this.sampleFailedRows.push({
        rowNumber: failedRow.rowNumber,
        originalData: failedRow.originalData,
        validationErrors: failedRow.validationErrors
      });
    }
  }
}

module.exports = {
  FILE_STATUS,
  TASK_STATUS,
  APPROVAL_STATUS,
  UploadFile,
  SandboxTask,
  ParseRule,
  FailedRow,
  PublishRequest,
  ParseSummary
};

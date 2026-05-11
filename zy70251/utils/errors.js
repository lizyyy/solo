class BusinessError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.statusCode = 400;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
}

class DuplicateSubmissionError extends BusinessError {
  constructor(resource, identifier, details = {}) {
    super(`${resource} 已存在，请勿重复提交`, 'DUPLICATE_SUBMISSION', {
      resource,
      identifier,
      ...details
    });
    this.statusCode = 409;
  }
}

class StatusConflictError extends BusinessError {
  constructor(entityType, entityId, currentStatus, allowedStatuses, operation) {
    super(`${entityType} [${entityId}] 当前状态 [${currentStatus}] 不允许执行 [${operation}] 操作`, 'STATUS_CONFLICT', {
      entityType,
      entityId,
      currentStatus,
      allowedStatuses,
      operation
    });
    this.statusCode = 409;
  }
}

class NotFoundError extends BusinessError {
  constructor(resource, identifier) {
    super(`${resource} [${identifier}] 不存在`, 'NOT_FOUND', {
      resource,
      identifier
    });
    this.statusCode = 404;
  }
}

class SourceRecordMissingError extends BusinessError {
  constructor(sourceType, sourceId, dependentType, dependentId) {
    super(`来源记录 ${sourceType} [${sourceId}] 不存在，无法处理 ${dependentType} [${dependentId}]`, 'SOURCE_RECORD_MISSING', {
      sourceType,
      sourceId,
      dependentType,
      dependentId
    });
    this.statusCode = 422;
  }
}

class ValidationError extends BusinessError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.statusCode = 400;
  }
}

class InvalidTransitionError extends BusinessError {
  constructor(entityType, fromStatus, toStatus) {
    super(`${entityType} 状态转换无效: ${fromStatus} -> ${toStatus}`, 'INVALID_TRANSITION', {
      entityType,
      fromStatus,
      toStatus
    });
    this.statusCode = 409;
  }
}

class BatchNotEmptyError extends BusinessError {
  constructor(batchId, specimenCount) {
    super(`批次 [${batchId}] 不为空 (包含 ${specimenCount} 个标本)，无法执行此操作`, 'BATCH_NOT_EMPTY', {
      batchId,
      specimenCount
    });
    this.statusCode = 409;
  }
}

class ReportAlreadyExistsError extends BusinessError {
  constructor(specimenId, reportId) {
    super(`标本 [${specimenId}] 已有报告 [${reportId}]，请勿重复创建`, 'REPORT_ALREADY_EXISTS', {
      specimenId,
      reportId
    });
    this.statusCode = 409;
  }
}

class ColdChainIncompleteError extends BusinessError {
  constructor(batchId, incompleteSegments) {
    super(`批次 [${batchId}] 冷链不完整，存在 ${incompleteSegments.length} 个未完成的冷链片段`, 'COLD_CHAIN_INCOMPLETE', {
      batchId,
      incompleteSegments
    });
    this.statusCode = 409;
  }
}

module.exports = {
  BusinessError,
  DuplicateSubmissionError,
  StatusConflictError,
  NotFoundError,
  SourceRecordMissingError,
  ValidationError,
  InvalidTransitionError,
  BatchNotEmptyError,
  ReportAlreadyExistsError,
  ColdChainIncompleteError
};

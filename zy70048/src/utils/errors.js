class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源未找到') {
    super(message, 404, 'NOT_FOUND');
  }
}

class StateTransitionError extends AppError {
  constructor(message, details = null) {
    super(message, 409, 'STATE_TRANSITION_ERROR');
    this.details = details;
  }
}

class DuplicateSubmissionError extends AppError {
  constructor(message = '重复提交', details = null) {
    super(message, 409, 'DUPLICATE_SUBMISSION');
    this.details = details;
  }
}

class ConflictError extends AppError {
  constructor(message = '资源冲突', details = null) {
    super(message, 409, 'CONFLICT_ERROR');
    this.details = details;
  }
}

class BusinessRuleError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'BUSINESS_RULE_ERROR');
    this.details = details;
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  StateTransitionError,
  DuplicateSubmissionError,
  ConflictError,
  BusinessRuleError
};

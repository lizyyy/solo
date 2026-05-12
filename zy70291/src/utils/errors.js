class AppError extends Error {
  constructor(message, status = 400, code = 'APP_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AppError';
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

class StateConflictError extends AppError {
  constructor(message, currentState = null) {
    super(message, 409, 'STATE_CONFLICT');
    this.currentState = currentState;
  }
}

class DuplicateRequestError extends AppError {
  constructor(message, existingId = null) {
    super(message, 409, 'DUPLICATE_REQUEST');
    this.existingId = existingId;
  }
}

class NotFoundError extends AppError {
  constructor(message, resource = null) {
    super(message, 404, 'NOT_FOUND');
    this.resource = resource;
  }
}

class SourceRecordMissingError extends AppError {
  constructor(message, sourceId = null) {
    super(message, 422, 'SOURCE_RECORD_MISSING');
    this.sourceId = sourceId;
  }
}

function handleAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ValidationError,
  StateConflictError,
  DuplicateRequestError,
  NotFoundError,
  SourceRecordMissingError,
  handleAsync
};

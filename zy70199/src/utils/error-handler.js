class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class StateConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'STATE_CONFLICT');
  }
}

class DocumentMissingError extends AppError {
  constructor(message, missingDocuments) {
    super(message, 422, 'DOCUMENTS_MISSING');
    this.missingDocuments = missingDocuments;
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND');
  }
}

class DuplicateOperationError extends AppError {
  constructor(message) {
    super(message, 400, 'DUPLICATE_OPERATION');
  }
}

module.exports = {
  AppError,
  ValidationError,
  StateConflictError,
  DocumentMissingError,
  NotFoundError,
  DuplicateOperationError
};

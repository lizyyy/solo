export class AppError extends Error {
  statusCode: number;
  code: string;
  
  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(message: string, code: string = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class DuplicateOperationError extends AppError {
  constructor(message: string, code: string = 'DUPLICATE_OPERATION') {
    super(message, 409, code);
  }
}

export class StatusTransitionError extends AppError {
  constructor(message: string, code: string = 'INVALID_TRANSITION') {
    super(message, 400, code);
  }
}

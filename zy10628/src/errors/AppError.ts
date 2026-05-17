export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly nextAction?: string;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>,
    nextAction?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.nextAction = nextAction;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, nextAction?: string) {
    super(message, 'VALIDATION_ERROR', 400, details, nextAction);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, nextAction?: string) {
    super(message, 'NOT_FOUND', 404, details, nextAction);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, nextAction?: string) {
    super(message, 'CONFLICT', 409, details, nextAction);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, nextAction?: string) {
    super(message, 'UNAUTHORIZED', 401, details, nextAction);
    this.name = 'UnauthorizedError';
  }
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ConcurrencyError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONCURRENCY_CONFLICT');
  }
}

export class IdempotencyConflict extends AppError {
  constructor(message: string, public cachedResponse?: { code: number; body: unknown }) {
    super(message, 409, 'IDEMPOTENCY_CONFLICT');
  }
}

export class LockAcquisitionError extends AppError {
  constructor(message: string) {
    super(message, 409, 'LOCK_ACQUISITION_FAILED');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

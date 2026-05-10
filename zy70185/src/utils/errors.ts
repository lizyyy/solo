export class BusinessError extends Error {
  constructor(
    public message: string,
    public code: string = 'BUSINESS_ERROR',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class ValidationError extends BusinessError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends BusinessError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class StateTransitionError extends BusinessError {
  constructor(
    message: string,
    public currentState: string,
    public targetState: string
  ) {
    super(message, 'STATE_TRANSITION_ERROR');
    this.name = 'StateTransitionError';
  }
}

export class LockedError extends BusinessError {
  constructor(message: string) {
    super(message, 'LOCKED_ERROR');
    this.name = 'LockedError';
  }
}

export class IdempotencyError extends BusinessError {
  constructor(message: string) {
    super(message, 'IDEMPOTENCY_ERROR');
    this.name = 'IdempotencyError';
  }
}

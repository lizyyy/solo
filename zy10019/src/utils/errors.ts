import { PoolError } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class PoolException extends Error {
  public readonly code: string;
  public readonly timestamp: number;
  public readonly connectionId?: string;
  public readonly requestId?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'POOL_ERROR',
    connectionId?: string,
    requestId?: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PoolException';
    this.code = code;
    this.timestamp = Date.now();
    this.connectionId = connectionId;
    this.requestId = requestId;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  toPoolError(): PoolError {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      connectionId: this.connectionId,
      requestId: this.requestId,
      stack: this.stack,
      context: this.context
    };
  }

  static fromError(error: Error, code?: string, context?: Record<string, unknown>): PoolException {
    const derivedCode = code || 
      (error as NodeJS.ErrnoException).code || 
      'UNKNOWN_ERROR';
    
    return new PoolException(
      error.message,
      derivedCode,
      undefined,
      undefined,
      {
        ...context,
        originalError: error.name,
        originalStack: error.stack
      }
    );
  }
}

export class ConnectionTimeoutException extends PoolException {
  constructor(waitTime: number, requestId?: string) {
    super(
      `Connection acquire timed out after ${waitTime}ms`,
      'ACQUIRE_TIMEOUT',
      undefined,
      requestId,
      { waitTime }
    );
    this.name = 'ConnectionTimeoutException';
  }
}

export class PoolExhaustedException extends PoolException {
  constructor(maxConnections: number, pendingRequests: number, requestId?: string) {
    super(
      `Pool exhausted: max=${maxConnections}, pending=${pendingRequests}`,
      'POOL_EXHAUSTED',
      undefined,
      requestId,
      { maxConnections, pendingRequests }
    );
    this.name = 'PoolExhaustedException';
  }
}

export class ConnectionValidationException extends PoolException {
  constructor(connectionId: string, reason: string, requestId?: string) {
    super(
      `Connection validation failed: ${reason}`,
      'VALIDATION_FAILED',
      connectionId,
      requestId,
      { reason }
    );
    this.name = 'ConnectionValidationException';
  }
}

export class CircuitBreakerOpenException extends PoolException {
  constructor(recoveryTime: number, requestId?: string) {
    super(
      `Circuit breaker is open. Will try again in ${recoveryTime}ms`,
      'CIRCUIT_BREAKER_OPEN',
      undefined,
      requestId,
      { recoveryTime }
    );
    this.name = 'CircuitBreakerOpenException';
  }
}

export class ConnectionDestroyedException extends PoolException {
  constructor(connectionId: string, reason: string) {
    super(
      `Connection destroyed: ${reason}`,
      'CONNECTION_DESTROYED',
      connectionId,
      undefined,
      { reason }
    );
    this.name = 'ConnectionDestroyedException';
  }
}

export class IdempotencyConflictException extends PoolException {
  constructor(key: string, existingStatus: string, requestId?: string) {
    super(
      `Idempotency conflict: key=${key} is already ${existingStatus}`,
      'IDEMPOTENCY_CONFLICT',
      undefined,
      requestId,
      { key, existingStatus }
    );
    this.name = 'IdempotencyConflictException';
  }
}

export function createPoolError(
  message: string,
  code: string = 'POOL_ERROR',
  connectionId?: string,
  requestId?: string,
  context?: Record<string, unknown>
): PoolError {
  return {
    code,
    message,
    timestamp: Date.now(),
    connectionId,
    requestId,
    context
  };
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack}`;
  }
  return String(error);
}

export function generateErrorId(): string {
  return `err_${uuidv4().substring(0, 12)}`;
}

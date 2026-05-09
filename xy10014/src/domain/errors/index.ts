export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class BillNotFoundError extends AppError {
  constructor(billId: string) {
    super(
      `Bill not found: ${billId}`,
      'BILL_NOT_FOUND',
      404,
      { billId }
    );
  }
}

export class BillAlreadyDeletedError extends AppError {
  constructor(billId: string) {
    super(
      `Bill has been deleted: ${billId}`,
      'BILL_ALREADY_DELETED',
      400,
      { billId }
    );
  }
}

export class GroupNotFoundError extends AppError {
  constructor(groupId: string) {
    super(
      `Group not found: ${groupId}`,
      'GROUP_NOT_FOUND',
      404,
      { groupId }
    );
  }
}

export class AggregateNotFoundError extends AppError {
  constructor(aggregateId: string) {
    super(
      `Aggregate not found: ${aggregateId}`,
      'AGGREGATE_NOT_FOUND',
      404,
      { aggregateId }
    );
  }
}

export class InvalidShareTotalError extends AppError {
  constructor() {
    super(
      'Sum of share amounts does not equal total amount',
      'INVALID_SHARE_TOTAL',
      400
    );
  }
}

export class InvalidPaidTotalError extends AppError {
  constructor() {
    super(
      'Sum of paid amounts does not equal total amount',
      'INVALID_PAID_TOTAL',
      400
    );
  }
}

export class DuplicateCommandError extends AppError {
  constructor(commandId: string) {
    super(
      `Command already executed: ${commandId}`,
      'DUPLICATE_COMMAND',
      409,
      { commandId }
    );
  }
}

export class ConcurrencyConflictError extends AppError {
  readonly aggregateId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;
  readonly conflictDetails?: Record<string, any>;

  constructor(data: {
    aggregateId: string;
    expectedVersion: number;
    actualVersion: number;
    conflictDetails?: Record<string, any>;
  }) {
    super(
      `Concurrency conflict on aggregate ${data.aggregateId}: expected version ${data.expectedVersion}, got ${data.actualVersion}`,
      'CONCURRENCY_CONFLICT',
      409,
      {
        aggregateId: data.aggregateId,
        expectedVersion: data.expectedVersion,
        actualVersion: data.actualVersion,
        conflictDetails: data.conflictDetails,
      }
    );
    this.aggregateId = data.aggregateId;
    this.expectedVersion = data.expectedVersion;
    this.actualVersion = data.actualVersion;
    this.conflictDetails = data.conflictDetails;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ExportError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'EXPORT_ERROR', 500, details);
  }
}

export class ProjectionError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'PROJECTION_ERROR', 500, details);
  }
}

export class EventStoreError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'EVENT_STORE_ERROR', 500, details);
  }
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  APPROVAL_FLOW_ERROR = 'APPROVAL_FLOW_ERROR',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TASK_EXECUTION_ERROR = 'TASK_EXECUTION_ERROR'
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(ErrorCode.NOT_FOUND, `${entity} with id ${id} not found`, { entity, id });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.CONFLICT, message, details);
  }
}

export class BusinessRuleViolationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.BUSINESS_RULE_VIOLATION, message, details);
  }
}

export class InsufficientInventoryError extends AppError {
  constructor(pesticideName: string, required: number, available: number) {
    super(
      ErrorCode.INSUFFICIENT_INVENTORY,
      `Insufficient inventory for ${pesticideName}. Required: ${required}, Available: ${available}`,
      { pesticideName, required, available }
    );
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(
    fromStatus: string,
    toStatus: string,
    stage?: string
  ) {
    super(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Invalid state transition from ${fromStatus} to ${toStatus}${stage ? ` at stage ${stage}` : ''}`,
      { fromStatus, toStatus, stage }
    );
  }
}

export class ApprovalFlowError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.APPROVAL_FLOW_ERROR, message, details);
  }
}

export class TaskExecutionError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.TASK_EXECUTION_ERROR, message, details, false);
  }
}

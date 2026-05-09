export const ERROR_CODES = {
  REPLACEMENT_NOT_FOUND: 'REPLACEMENT_NOT_FOUND',
  INVALID_STEP_TRANSITION: 'INVALID_STEP_TRANSITION',
  STEP_ALREADY_COMPLETED: 'STEP_ALREADY_COMPLETED',
  DEPENDENCY_STEP_FAILED: 'DEPENDENCY_STEP_FAILED',
  DEPENDENCY_STEP_IN_PROGRESS: 'DEPENDENCY_STEP_IN_PROGRESS',
  STEP_OUT_OF_ORDER: 'STEP_OUT_OF_ORDER',
  LOGISTICS_ALREADY_DELIVERED: 'LOGISTICS_ALREADY_DELIVERED',
  LOGISTICS_STEP_OUT_OF_ORDER: 'LOGISTICS_STEP_OUT_OF_ORDER',
  ALREADY_ACTIVATED: 'ALREADY_ACTIVATED',
  CANNOT_COMPENSATE_SUCCESS: 'CANNOT_COMPENSATE_SUCCESS',
  NOT_STUCK: 'NOT_STUCK',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export class ServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

export const createError = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ServiceError => {
  return new ServiceError(code, message, details);
};

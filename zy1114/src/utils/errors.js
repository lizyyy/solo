class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

class ConflictError extends AppError {
  constructor(message, conflicts) {
    super(message, 409, 'CONFLICT_ERROR');
    this.conflicts = conflicts;
  }
}

class StateTransitionError extends AppError {
  constructor(message, currentState, targetState) {
    super(message, 400, 'STATE_TRANSITION_ERROR');
    this.currentState = currentState;
    this.targetState = targetState;
  }
}

class InsufficientDepositError extends AppError {
  constructor(message, required, available) {
    super(message, 400, 'INSUFFICIENT_DEPOSIT');
    this.required = required;
    this.available = available;
  }
}

class NotFoundError extends AppError {
  constructor(message, resource) {
    super(message, 404, 'NOT_FOUND');
    this.resource = resource;
  }
}

class AmountError extends AppError {
  constructor(message, amountType) {
    super(message, 400, 'AMOUNT_ERROR');
    this.amountType = amountType;
  }
}

function errorHandler(err, req, res, next) {
  console.error('错误:', err);
  
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.field && { field: err.field }),
        ...(err.conflicts && { conflicts: err.conflicts }),
        ...(err.currentState && { currentState: err.currentState }),
        ...(err.targetState && { targetState: err.targetState }),
        ...(err.required !== undefined && { required: err.required }),
        ...(err.available !== undefined && { available: err.available }),
        ...(err.resource && { resource: err.resource }),
        ...(err.amountType && { amountType: err.amountType })
      }
    });
  }
  
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试'
    }
  });
}

module.exports = {
  AppError,
  ValidationError,
  ConflictError,
  StateTransitionError,
  InsufficientDepositError,
  NotFoundError,
  AmountError,
  errorHandler
};

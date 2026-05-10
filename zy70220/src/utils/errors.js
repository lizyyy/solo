class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.field = field;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class ResourceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResourceNotFoundError';
    this.statusCode = 404;
  }
}

class WaterQuotaExceededError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'WaterQuotaExceededError';
    this.statusCode = 422;
    this.details = details;
  }
}

class InvalidStateTransitionError extends Error {
  constructor(message, from, to) {
    super(message);
    this.name = 'InvalidStateTransitionError';
    this.statusCode = 409;
    this.fromState = from;
    this.toState = to;
  }
}

const handleError = (err, res) => {
  console.error('Error:', err);
  
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        type: err.name,
        message: err.message,
        ...(err.field && { field: err.field }),
        ...(err.details && { details: err.details }),
        ...(err.fromState && { fromState: err.fromState }),
        ...(err.toState && { toState: err.toState })
      }
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      type: 'InternalServerError',
      message: '服务器内部错误'
    }
  });
};

const requireFields = (data, fields) => {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || 
        (typeof data[field] === 'string' && data[field].trim() === '')) {
      throw new ValidationError(`字段 '${field}' 不能为空`, field);
    }
  }
};

module.exports = {
  ValidationError,
  ConflictError,
  ResourceNotFoundError,
  WaterQuotaExceededError,
  InvalidStateTransitionError,
  handleError,
  requireFields
};

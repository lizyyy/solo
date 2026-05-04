class ApiError extends Error {
  constructor(statusCode, message, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, message, code);
  }
}

class BadRequestError extends ApiError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details = null) {
    super(400, message, code, details);
  }
}

class ConflictError extends ApiError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(409, message, code);
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Validation failed', code = 'VALIDATION_ERROR', details = null) {
    super(422, message, code, details);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  };
  
  if (err.isOperational) {
    statusCode = err.statusCode;
    errorResponse.error.message = err.message;
    errorResponse.error.code = err.code || 'ERROR';
    if (err.details) {
      errorResponse.error.details = err.details;
    }
  } else if (err.name === 'ValidationError' || err.isJoi) {
    statusCode = 422;
    errorResponse.error.message = 'Validation failed';
    errorResponse.error.code = 'VALIDATION_ERROR';
    if (err.details) {
      errorResponse.error.details = err.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
    }
  } else if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 409;
    errorResponse.error.message = 'Database constraint violation';
    errorResponse.error.code = 'DB_CONSTRAINT_VIOLATION';
    errorResponse.error.details = err.message;
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    errorResponse.error.message = 'File not found';
    errorResponse.error.code = 'FILE_NOT_FOUND';
    errorResponse.error.details = err.path;
  } else if (err.message && err.message.includes('Circular dependency')) {
    statusCode = 422;
    errorResponse.error.message = err.message;
    errorResponse.error.code = 'CIRCULAR_DEPENDENCY';
  }
  
  if (process.env.NODE_ENV === 'development' && !err.isOperational) {
    errorResponse.error.stack = err.stack;
  }
  
  console.error('[Error]', {
    statusCode,
    message: err.message,
    code: err.code,
    url: req.originalUrl,
    method: req.method
  });
  
  res.status(statusCode).json(errorResponse);
};

const notFoundHandler = (req, res, next) => {
  throw new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  NotFoundError,
  BadRequestError,
  ConflictError,
  ValidationError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};

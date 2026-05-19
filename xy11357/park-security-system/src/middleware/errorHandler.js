function errorHandler(err, req, res, next) {
  console.error('错误:', err);

  let statusCode = 500;
  let errorMessage = '服务器内部错误';
  let errorCode = 'INTERNAL_ERROR';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = err.message;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorMessage = err.message;
    errorCode = 'NOT_FOUND';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    errorMessage = err.message;
    errorCode = 'CONFLICT';
  } else if (err.name === 'BadRequestError') {
    statusCode = 400;
    errorMessage = err.message;
    errorCode = 'BAD_REQUEST';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      details: err.details || null
    },
    requestId: req.requestId || null
  });
}

function requestIdMiddleware(req, res, next) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  req.requestId = `req_${timestamp}_${random}`;
  next();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

module.exports = {
  errorHandler,
  requestIdMiddleware,
  asyncHandler,
  ValidationError,
  NotFoundError,
  ConflictError,
  BadRequestError
};

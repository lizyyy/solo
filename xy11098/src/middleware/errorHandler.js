class AppError extends Error {
  constructor(message, statusCode, code, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorCodes = {
  CONSECUTIVE_WARNING_NOT_UPGRADED: 'CONSECUTIVE_WARNING_NOT_UPGRADED',
  WARNING_INCONSISTENCY: 'WARNING_INCONSISTENCY',
  DUPLICATE_WARNING_NO: 'DUPLICATE_WARNING_NO',
  SILENT_OVERWRITE_ATTEMPT: 'SILENT_OVERWRITE_ATTEMPT',
  GREENHOUSE_NOT_FOUND: 'GREENHOUSE_NOT_FOUND',
  WARNING_NOT_FOUND: 'WARNING_NOT_FOUND',
  INVALID_SEVERITY_LEVEL: 'INVALID_SEVERITY_LEVEL',
  INVALID_STATUS: 'INVALID_STATUS',
  IMPORT_BAD_ROW: 'IMPORT_BAD_ROW',
  WITHDRAWN_REAPPLY_PATH_ERROR: 'WITHDRAWN_REAPPLY_PATH_ERROR'
};

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      details: err.details || {}
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  console.error(`[${new Date().toISOString()}] Error:`, err.message, err.details);

  res.status(statusCode).json(response);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorCodes,
  errorHandler,
  asyncHandler
};
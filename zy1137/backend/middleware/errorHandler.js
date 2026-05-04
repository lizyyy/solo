class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    error = new AppError('数据验证失败', 400, 'VALIDATION_ERROR');
    error.errors = errors;
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    error = new AppError('数据已存在', 409, 'DUPLICATE_ENTRY');
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('文件大小超过限制', 400, 'FILE_TOO_LARGE');
  }

  if (!error.isOperational) {
    console.error('未预期的错误:', err);
    error = new AppError('服务器内部错误', 500, 'INTERNAL_ERROR');
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      errors: error.errors,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler
};

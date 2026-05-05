const { STATUS_LABELS } = require('../database/database');

class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  console.error('错误:', err.message);
  
  let statusCode = err.statusCode || 500;
  let errorMessage = err.message || '服务器内部错误';
  let code = err.code;
  
  if (!err.isOperational) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      statusCode = 400;
      errorMessage = '数据约束冲突';
      code = 'CONSTRAINT_ERROR';
    } else if (err.code === 'SQLITE_ERROR') {
      statusCode = 500;
      errorMessage = '数据库操作错误';
      code = 'DATABASE_ERROR';
    } else if (err.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = err.message;
      code = 'VALIDATION_ERROR';
    } else if (err.type === 'entity.parse.failed') {
      statusCode = 400;
      errorMessage = '请求体格式错误';
      code = 'PAYLOAD_ERROR';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: errorMessage,
      code: code,
      timestamp: new Date().toISOString()
    }
  });
};

const notFoundHandler = (req, res, next) => {
  throw new AppError(`未找到资源: ${req.originalUrl}`, 404, 'RESOURCE_NOT_FOUND');
};

const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  catchAsync
};

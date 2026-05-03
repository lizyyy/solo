const { ERROR_CODES } = require('../config/constants');

class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  // 默认错误信息
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || '服务器内部错误';
  let details = null;
  
  // 处理不同类型的错误
  if (err.isOperational) {
    // 业务逻辑错误
    message = err.message;
  } else if (err.name === 'ValidationError') {
    // Joi 验证错误
    statusCode = 400;
    code = ERROR_CODES.INVALID_INPUT;
    message = '输入参数验证失败';
    details = err.details;
  } else if (err.name === 'SequelizeValidationError') {
    // Sequelize 验证错误
    statusCode = 400;
    code = ERROR_CODES.INVALID_INPUT;
    message = '数据验证失败';
    details = err.errors.map(e => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    // 唯一约束错误
    statusCode = 409;
    code = ERROR_CODES.CONFLICT;
    message = '数据冲突';
    details = err.errors.map(e => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    // 外键约束错误
    statusCode = 400;
    code = ERROR_CODES.INVALID_INPUT;
    message = '关联数据不存在';
  } else if (err.code === 'ECONNREFUSED') {
    // 数据库连接错误
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = '数据库连接失败';
  }
  
  // 开发环境下显示完整错误堆栈
  if (process.env.NODE_ENV === 'development') {
    details = details || err.stack;
  }
  
  // 构建错误响应
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
  
  // 记录错误日志
  console.error(`[${new Date().toISOString()}] Error:`, {
    code,
    message,
    statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });
  
  res.status(statusCode).json(errorResponse);
};

const notFoundHandler = (req, res, next) => {
  const err = new AppError(`找不到路径: ${req.method} ${req.path}`, 404, 'NOT_FOUND');
  next(err);
};

const wrapAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  wrapAsync,
};

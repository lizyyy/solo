class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 500 ? 'error' : 'fail';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = '文件大小超过限制（最大50MB）';
  }

  if (err.code === 'ENOENT') {
    statusCode = 404;
    message = '请求的资源不存在';
  }

  if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    statusCode = 400;
    message = 'JSON 格式错误';
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  if (process.env.NODE_ENV === 'development') {
    res.status(statusCode).json({
      success: false,
      error: {
        message: message,
        stack: err.stack,
        code: err.code
      },
      data: null
    });
  } else {
    res.status(statusCode).json({
      success: false,
      message: message,
      data: null
    });
  }
};

const notFound = (req, res, next) => {
  const err = new AppError(`无法找到 ${req.originalUrl} 路由`, 404);
  next(err);
};

module.exports = {
  errorHandler,
  notFound,
  AppError
};

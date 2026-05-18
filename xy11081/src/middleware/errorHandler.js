class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let details = err.details || null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '请求参数验证失败';
    details = err.details;
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    statusCode = 409;
    message = '备件编码已存在，请使用其他编码';
  }

  if (err.code === 'SQLITE_ERROR') {
    statusCode = 400;
    message = '数据库操作错误，请检查请求参数';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode,
      message: message,
      details: details,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 404,
      message: '请求的资源不存在',
      path: req.path,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = {
  ApiError,
  errorHandler,
  notFoundHandler
};

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);

  let statusCode = 500;
  let message = '服务器内部错误';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = err.message;
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    message = err.message;
  } else if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 409;
    if (err.message.includes('UNIQUE constraint')) {
      message = '数据已存在，请勿重复添加';
    } else {
      message = '数据约束冲突';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
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

module.exports = {
  errorHandler,
  ValidationError,
  NotFoundError,
  ConflictError
};

class AppError extends Error {
  constructor(message, statusCode, errorCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      errorCode: err.errorCode,
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  } else {
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误，请稍后重试',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { AppError, errorHandler };

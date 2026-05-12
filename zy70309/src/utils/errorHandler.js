class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  console.error(err);
  
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || '服务器内部错误',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  if (err.details) {
    response.error.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = { AppError, errorHandler };

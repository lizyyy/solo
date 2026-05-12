const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || '服务器内部错误'
    }
  });
};

class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

module.exports = {
  errorHandler,
  AppError
};

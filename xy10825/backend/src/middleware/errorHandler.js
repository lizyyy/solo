function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || '内部服务器错误',
    timestamp: new Date().toISOString()
  });
}

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, AppError };

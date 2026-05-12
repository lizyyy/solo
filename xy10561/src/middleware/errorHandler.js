function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  
  const response = {
    success: false,
    error: {
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message || 'Internal server error',
      statusCode
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  console.error(`[${new Date().toISOString()}] Error:`, {
    code: err.code,
    message: err.message,
    path: req.path,
    method: req.method,
    statusCode
  });

  res.status(statusCode).json(response);
}

module.exports = errorHandler;

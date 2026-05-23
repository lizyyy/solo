const detourService = require('../services/detourService');

const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message);

  detourService.logError(
    req.path,
    req.method,
    req.body,
    err.message,
    'error_returned'
  );

  const statusCode = err.statusCode || 400;
  res.status(statusCode).json({
    success: false,
    error: err.message,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;

const logger = require('../utils/logger');
const { error: errorResponse } = require('../utils/response');

function errorHandler(err, req, res, next) {
  logger.error('Error:', err);
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = err.message || 'Resource Not Found';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate Key Error';
  }
  
  res.status(statusCode).json(errorResponse(message, statusCode, err.details));
}

module.exports = errorHandler;

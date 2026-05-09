const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (!error.isOperational) {
    logger.error('非预期错误:', err);
    error = new AppError('服务器内部错误', 500, 'INTERNAL_ERROR');
  }

  const response = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details })
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
  }

  res.status(error.statusCode || 500).json(response);
};

module.exports = errorHandler;

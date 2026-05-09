const { ERROR_CODES } = require('../utils/constants');
const { createResponse } = require('../utils/helpers');

function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || ERROR_CODES.INTERNAL_ERROR;
  const message = err.message || '服务器内部错误';
  const details = err.details || null;
  
  res.status(statusCode).json(
    createResponse(false, null, message, {
    statusCode,
    details
  })
  );
}

function notFoundHandler(req, res, next) {
  res.status(404).json(
    createResponse(false, null, '接口不存在')
  );
}

module.exports = {
  errorHandler,
  notFoundHandler
};

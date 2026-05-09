const logger = require('../utils/logger');
const { ApiResponse } = require('../utils/response');

function errorHandler(err, req, res, next) {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    operatorId: req.operator?.id
  });

  const statusCode = err.statusCode || 500;
  
  if (err.name === 'ValidationError' || err.name === 'JoiValidationError') {
    return res.status(400).json(ApiResponse.validationError(
      err.details?.map(d => ({ field: d.path.join('.'), message: d.message })) || [err.message],
      '参数校验失败'
    ));
  }

  if (err.name === 'ApiError') {
    return res.status(statusCode).json(ApiResponse.error(err.message, statusCode, err.code));
  }

  if (err.code === '23505') {
    return res.status(409).json(ApiResponse.error('数据已存在，请勿重复操作', 409, 'DUPLICATE_ENTRY'));
  }

  if (err.code === '23503') {
    return res.status(400).json(ApiResponse.error('关联数据不存在', 400, 'REFERENCE_ERROR'));
  }

  return res.status(500).json(ApiResponse.error(
    err.message || '服务器内部错误',
    500,
    err.code
  ));
}

function notFoundHandler(req, res) {
  res.status(404).json(ApiResponse.error(`请求的资源不存在: ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

module.exports = { errorHandler, notFoundHandler };

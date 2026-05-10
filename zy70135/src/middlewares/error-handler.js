const ResponseUtils = require('../utils/response');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user ? req.user.username : 'anonymous',
  });

  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ResponseUtils.badRequest(res, '数据验证失败', errors);
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'unknown';
    return ResponseUtils.error(res, {
      statusCode: 409,
      code: 'DUPLICATE_ENTRY',
      message: `${field} 已存在`,
      isOperational: true,
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return ResponseUtils.error(res, {
      statusCode: 400,
      code: 'FOREIGN_KEY_VIOLATION',
      message: '关联数据不存在或无效',
      isOperational: true,
    });
  }

  if (err.isOperational) {
    return ResponseUtils.error(res, err);
  }

  return ResponseUtils.error(res, {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    isOperational: true,
  });
};

const notFoundHandler = (req, res) => {
  ResponseUtils.notFound(res, `请求的路径 ${req.path} 不存在`);
};

module.exports = {
  errorHandler,
  notFoundHandler,
};

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('请求处理错误:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: '参数验证失败',
      message: err.message,
      details: err.details
    });
  }

  if (err.name === 'OptimisticLockError') {
    return res.status(409).json({
      error: '并发冲突',
      message: '数据已被其他用户修改，请刷新后重试',
      retryAfter: 1
    });
  }

  if (err.name === 'IdempotencyConflict') {
    return res.status(409).json({
      error: '请求冲突',
      message: '相同的请求正在处理中，请稍后重试'
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      error: '资源不存在',
      message: err.message
    });
  }

  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'production'
      ? '服务器暂时不可用，请稍后重试'
      : err.message
  });
};

module.exports = errorHandler;

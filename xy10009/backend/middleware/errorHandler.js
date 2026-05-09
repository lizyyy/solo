const { OptimisticLockError } = require('../utils/optimisticLock');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'OptimisticLockError') {
    return res.status(409).json({
      success: false,
      message: err.message,
      code: 'OPTIMISTIC_LOCK_ERROR',
      currentVersion: err.currentVersion,
      providedVersion: err.providedVersion
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: err.errors
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: '数据已存在',
      errors: err.errors.map(e => e.message)
    });
  }

  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
};

module.exports = errorHandler;
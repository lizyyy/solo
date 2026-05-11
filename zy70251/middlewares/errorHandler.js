const { BusinessError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  console.error('错误:', err);

  if (err instanceof BusinessError) {
    return res.status(err.statusCode || 400).json(err.toJSON());
  }

  if (err.name === 'BusinessError') {
    return res.status(err.statusCode || 400).json({
      error: {
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message,
        details: err.details || {}
      }
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_SUBMISSION',
        message: '数据库约束冲突，可能是重复提交',
        details: { sqliteError: err.message }
      }
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}
    }
  });
}

module.exports = errorHandler;

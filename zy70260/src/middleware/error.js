const { BusinessError, ERROR_CODES } = require('../utils');

function errorHandler(err, req, res, next) {
  if (err instanceof BusinessError) {
    return res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  console.error('系统错误:', err);
  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.SYSTEM_ERROR,
      message: '系统内部错误',
      details: process.env.NODE_ENV === 'development' ? err.stack : null
    }
  });
}

function successHandler(data, message = '操作成功') {
  return {
    success: true,
    message,
    data
  };
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  successHandler,
  asyncHandler
};

function errorHandler(err, req, res, next) {
  console.error('❌ 错误:', err.message);
  console.error(err.stack);

  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message || '服务器内部错误';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = '无效的ID格式';
  } else if (err.name === 'MongoServerError' && err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    message = '数据重复';
  } else if (err.message.includes('不存在')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (err.message.includes('不允许') || err.message.includes('无法')) {
    statusCode = 400;
    errorCode = 'STATE_ERROR';
  } else if (err.message.includes('回调') || err.message.includes('URL')) {
    statusCode = 400;
    errorCode = 'CALLBACK_ERROR';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || req.id
    }
  });
}

module.exports = errorHandler;

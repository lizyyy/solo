function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  let statusCode = 500;
  let errorMessage = '服务器内部错误';
  let errorCode = 'INTERNAL_ERROR';
  let details = null;

  if (err.message) {
    if (err.message.includes('不存在')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      errorMessage = err.message;
    } else if (err.message.includes('不允许') || err.message.includes('当前状态')) {
      statusCode = 400;
      errorCode = 'INVALID_STATE';
      errorMessage = err.message;
    } else if (err.message.includes('已存在') || err.message.includes('重复') || err.message.includes('已有')) {
      statusCode = 409;
      errorCode = 'CONFLICT';
      errorMessage = err.message;
    } else if (err.message.includes('库存不足')) {
      statusCode = 422;
      errorCode = 'INVENTORY_SHORTAGE';
      errorMessage = err.message;
    } else {
      statusCode = 400;
      errorCode = 'BAD_REQUEST';
      errorMessage = err.message;
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      details
    },
    timestamp: new Date().toISOString()
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };

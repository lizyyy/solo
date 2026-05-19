function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    reason: '服务器内部错误',
    error: err.message
  });
}

module.exports = errorHandler;

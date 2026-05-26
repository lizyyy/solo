function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.message, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR'
  });
}

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    error: `接口不存在: ${req.method} ${req.originalUrl}`
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireOperator(req, res, next) {
  const operator = req.headers['x-operator'] || req.body.operator || req.query.operator;
  if (!operator) {
    return res.status(400).json({
      success: false,
      error: '缺少操作人标识，请通过 x-operator 请求头或 operator 参数提供'
    });
  }
  req.operator = operator;
  next();
}

module.exports = { errorHandler, notFoundHandler, asyncHandler, requireOperator };

const errorLogs = [];

module.exports = (err, req, res, next) => {
  const errorId = require('uuid').v4();
  const errorLog = {
    errorId,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    originalInput: {
      body: req.body,
      params: req.params,
      query: req.query
    },
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    processingBasis: err.processingBasis || '未知处理依据'
  };

  errorLogs.push(errorLog);
  console.error('[错误日志]', JSON.stringify(errorLog, null, 2));

  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    code: errorCode,
    message: err.message || '服务器内部错误',
    errorId,
    timestamp: new Date().toISOString(),
    details: err.details || null
  });
};

module.exports.errorLogs = errorLogs;
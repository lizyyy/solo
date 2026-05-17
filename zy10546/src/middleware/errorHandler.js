const db = require('../config/database');

function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const rawInput = JSON.stringify({
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    params: req.params,
    query: req.query
  });

  db.run(
    `INSERT INTO exception_logs (exception_type, raw_input, error_message, status)
     VALUES (?, ?, ?, ?)`,
    [err.name || 'UnknownError', rawInput, err.message, 'pending'],
    function(logErr) {
      if (logErr) {
        console.error('记录异常日志失败:', logErr);
      }
    }
  );

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? '服务器内部错误' : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = errorHandler;

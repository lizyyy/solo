const db = require('../config/database');

const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err);

  const requestBody = JSON.stringify(req.body || {});
  const errorMessage = err.message || '未知错误';
  const processingResult = err.code || 'ERROR';

  db.run(
    `INSERT INTO exception_logs 
     (api_path, request_method, request_body, error_message, processing_result) 
     VALUES (?, ?, ?, ?, ?)`,
    [req.path, req.method, requestBody, errorMessage, processingResult],
    (logErr) => {
      if (logErr) {
        console.error('保存异常日志失败:', logErr);
      }
    }
  );

  res.status(err.statusCode || 500).json({
    success: false,
    message: errorMessage,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
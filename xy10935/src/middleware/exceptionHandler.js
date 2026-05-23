const { run } = require('../db');

const logException = async (req, error, processingResult) => {
  try {
    await run(
      `INSERT INTO exception_logs 
       (request_path, request_method, request_body, error_type, error_message, processing_result)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.path,
        req.method,
        JSON.stringify(req.body),
        error.name || 'UnknownError',
        error.message || String(error),
        processingResult
      ]
    );
  } catch (logErr) {
    console.error('记录异常日志失败:', logErr);
  }
};

const exceptionHandler = async (err, req, res, next) => {
  console.error('API异常:', err);
  
  await logException(req, err, '系统自动拦截');
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      type: err.name || 'InternalServerError',
      message: err.message || '服务器内部错误',
      code: err.statusCode || 500
    }
  });
};

module.exports = {
  exceptionHandler,
  logException
};

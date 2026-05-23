const { runQuery } = require('../db');

function logException(apiPath, method, rawInput, errorMessage, handlingConclusion) {
  try {
    runQuery(
      `INSERT INTO exception_logs (api_path, request_method, raw_input, error_message, handling_conclusion)
       VALUES (?, ?, ?, ?, ?)`,
      [apiPath, method, JSON.stringify(rawInput), errorMessage, handlingConclusion]
    );
  } catch (logError) {
    console.error('记录异常日志失败:', logError);
  }
}

function exceptionHandler(err, req, res, next) {
  const rawInput = {
    body: req.body,
    query: req.query,
    params: req.params
  };
  
  logException(
    req.path,
    req.method,
    rawInput,
    err.message || '未知错误',
    err.conclusion || '返回错误响应'
  );

  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    conclusion: err.conclusion || '返回错误响应'
  });
}

module.exports = {
  logException,
  exceptionHandler
};

const db = require('../utils/database');

function logError(apiEndpoint, requestMethod, rawInput, error) {
  try {
    db.prepare(`
      INSERT INTO error_logs (api_endpoint, request_method, raw_input, error_message, error_stack)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      apiEndpoint,
      requestMethod,
      JSON.stringify(rawInput),
      error.message,
      error.stack
    );
  } catch (logError) {
    console.error('记录错误日志失败:', logError);
  }
}

function updateErrorHandling(errorId, handlingResult, handledBy) {
  try {
    db.prepare(`
      UPDATE error_logs
      SET handling_result = ?, handled_by = ?
      WHERE id = ?
    `).run(handlingResult, handledBy, errorId);
    return true;
  } catch (error) {
    console.error('更新错误处理结果失败:', error);
    return false;
  }
}

function errorHandler(err, req, res, next) {
  console.error('API Error:', err);
  
  logError(req.path, req.method, req.body, err);

  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    statusCode
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
}

module.exports = { errorHandler, notFoundHandler, logError, updateErrorHandling };

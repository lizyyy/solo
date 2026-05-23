const { v4: uuidv4 } = require('uuid');
const DBUtils = require('../utils/dbUtils');

const errorHandler = async (err, req, res, next) => {
  console.error('Error:', err);
  
  const requestId = req.headers['x-request-id'] || uuidv4();
  const originalInput = JSON.stringify({
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  const status = err.status || 500;
  let processingStatus = 'error';
  let processingResult = err.message || '服务器内部错误';
  
  if (status === 400) {
    processingStatus = 'invalid_input';
  } else if (status === 404) {
    processingStatus = 'not_found';
  }
  
  try {
    await DBUtils.insert('exception_logs', {
      request_id: requestId,
      endpoint: req.path,
      method: req.method,
      original_input: originalInput,
      error_message: err.stack || err.message,
      processing_result: processingResult,
      status: processingStatus
    });
  } catch (logErr) {
    console.error('记录异常日志失败:', logErr);
  }
  
  res.status(status).json({
    success: false,
    request_id: requestId,
    status: processingStatus,
    message: err.message || '服务器内部错误',
    data: null
  });
};

module.exports = errorHandler;

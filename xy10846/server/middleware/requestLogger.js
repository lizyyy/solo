const { run } = require('../database/connection');

function requestLogger(req, res, next) {
  const startTime = Date.now();
  const { method, originalUrl, body } = req;
  const responsibilityNode = req.headers['x-responsibility-node'] || 'unknown';

  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    let responseData = data;

    try {
      if (typeof data === 'string') {
        JSON.parse(data);
        responseData = data;
      } else if (typeof data === 'object') {
        responseData = JSON.stringify(data);
      }
    } catch (e) {
      responseData = String(data).substring(0, 1000);
    }

    const requestInput = Object.keys(body).length > 0 ? JSON.stringify(body).substring(0, 2000) : null;

    run(
      `INSERT INTO request_logs 
       (endpoint, method, request_input, response_result, responsibility_node, status_code, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [originalUrl, method, requestInput, responseData?.substring(0, 4000), responsibilityNode, res.statusCode, duration]
    ).catch(err => console.error('日志记录失败:', err.message));

    return originalSend.call(this, data);
  };

  next();
}

module.exports = requestLogger;

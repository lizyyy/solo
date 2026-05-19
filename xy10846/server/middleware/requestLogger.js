const db = require('../database/connection');

function requestLogger(req, res, next) {
  const startTime = Date.now();
  const endpoint = req.path;
  const method = req.method;
  const responsibilityNode = req.headers['x-responsibility-node'] || 'unknown';

  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    const status = res.statusCode < 400 ? 'success' : 'error';
    
    try {
      const stmt = db.prepare(`
        INSERT INTO request_logs 
        (endpoint, method, request_input, response_result, responsibility_node, status, error_message, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        endpoint,
        method,
        JSON.stringify(req.body),
        typeof body === 'string' ? body : JSON.stringify(body),
        responsibilityNode,
        status,
        status === 'error' ? (body.error || body.message || 'Unknown error') : null,
        duration
      );
    } catch (err) {
      console.error('记录请求日志失败:', err);
    }
    
    originalSend.call(this, body);
  };

  next();
}

module.exports = requestLogger;

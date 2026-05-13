const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const idempotentMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  db.get('SELECT * FROM idempotent_requests WHERE request_id = ?', [requestId], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: '数据库错误' });
    }
    
    if (row) {
      const responseData = JSON.parse(row.response_data);
      return res.status(responseData.status).json({
        ...responseData.body,
        from_cache: true
      });
    }
    
    req.requestId = requestId;
    req.saveIdempotentResponse = (status, body) => {
      const now = new Date().toISOString();
      db.run(
        'INSERT INTO idempotent_requests (id, request_id, api_path, request_data, response_data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), requestId, req.path, JSON.stringify(req.body), JSON.stringify({ status, body }), now],
        (err) => {
          if (err) {
            console.error('保存幂等响应失败:', err);
          }
        }
      );
    };
    
    next();
  });
};

module.exports = idempotentMiddleware;

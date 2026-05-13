const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const checkIdempotency = (requestType) => {
  return (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'] || uuidv4();
    
    db.get('SELECT * FROM idempotency_keys WHERE key = ?', [idempotencyKey], (err, row) => {
      if (err) {
        return next(err);
      }
      
      if (row) {
        const cachedResponse = JSON.parse(row.response_data);
        return res.status(cachedResponse.status).json(cachedResponse.data);
      }
      
      req.idempotencyKey = idempotencyKey;
      req.requestType = requestType;
      
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        const responseData = JSON.stringify({ status: res.statusCode, data });
        db.run(
          'INSERT INTO idempotency_keys (key, request_type, response_data) VALUES (?, ?, ?)',
          [idempotencyKey, requestType, responseData]
        );
        originalJson(data);
      };
      
      next();
    });
  };
};

module.exports = { checkIdempotency };
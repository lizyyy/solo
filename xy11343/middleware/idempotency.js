const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

const checkIdempotency = (action) => {
  return (req, res, next) => {
    const requestId = req.body.request_id || req.headers['x-request-id'];
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'request_id is required in body or X-Request-Id header'
      });
    }

    db.get(
      'SELECT * FROM idempotency_keys WHERE request_id = ? AND action = ?',
      [requestId, action],
      (err, row) => {
        if (err) {
          logger.error('Database error checking idempotency', { error: err.message });
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (row) {
          logger.info('Idempotent request detected, returning cached result', { requestId, action });
          const cachedResult = JSON.parse(row.result);
          return res.status(cachedResult.status || 200).json(cachedResult.body);
        }

        req.requestId = requestId;
        req.action = action;
        next();
      }
    );
  };
};

const saveIdempotencyResult = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(body) {
    const requestId = req.requestId;
    const action = req.action;
    
    if (requestId && action) {
      const result = JSON.stringify({
        status: res.statusCode,
        body: body
      });
      
      const id = uuidv4();
      db.run(
        'INSERT INTO idempotency_keys (id, request_id, action, result) VALUES (?, ?, ?, ?)',
        [id, requestId, action, result],
        (err) => {
          if (err) {
            logger.warn('Failed to save idempotency key', { requestId, error: err.message });
          }
        }
      );
    }
    
    return originalJson.call(this, body);
  };
  
  next();
};

module.exports = { checkIdempotency, saveIdempotencyResult };

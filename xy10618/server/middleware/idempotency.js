const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const checkIdempotency = (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }

  db.get('SELECT response FROM idempotency_keys WHERE key = ?', [idempotencyKey], (err, row) => {
    if (err) {
      return next(err);
    }
    
    if (row) {
      const cachedResponse = JSON.parse(row.response);
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }
    
    const originalJson = res.json;
    res.json = function(body) {
      const response = JSON.stringify({
        status: res.statusCode,
        body: body
      });
      
      db.run(
        'INSERT INTO idempotency_keys (id, key, response, created_at) VALUES (?, ?, ?, ?)',
        [uuidv4(), idempotencyKey, response, moment().toISOString()],
        (insertErr) => {
          if (insertErr) {
            console.error('Failed to save idempotency key:', insertErr);
          }
        }
      );
      
      originalJson.call(this, body);
    };
    
    next();
  });
};

module.exports = { checkIdempotency };

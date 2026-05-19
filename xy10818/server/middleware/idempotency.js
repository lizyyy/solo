const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const EXPIRE_HOURS = 24;

const getIdempotencyRecord = (key) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM idempotency_records WHERE idempotency_key = ? AND expires_at > CURRENT_TIMESTAMP',
      [key],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const saveIdempotencyRecord = (key, requestType, responseData) => {
  return new Promise((resolve, reject) => {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EXPIRE_HOURS);
    
    db.run(
      'INSERT OR REPLACE INTO idempotency_records (id, idempotency_key, request_type, response_data, expires_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), key, requestType, JSON.stringify(responseData), expiresAt.toISOString()],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers[IDEMPOTENCY_HEADER];
  
  if (!idempotencyKey) {
    return next();
  }

  try {
    const existingRecord = await getIdempotencyRecord(idempotencyKey);
    
    if (existingRecord) {
      const cachedResponse = JSON.parse(existingRecord.response_data);
      return res.status(cachedResponse.status || 200).json({
        ...cachedResponse.body,
        _idempotent: true,
        _cached_at: existingRecord.created_at
      });
    }

    const originalJson = res.json;
    res.json = function(data) {
      saveIdempotencyRecord(idempotencyKey, req.method + ' ' + req.path, {
        status: res.statusCode,
        body: data
      }).catch(console.error);
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    console.error('幂等处理错误:', error);
    next();
  }
};

module.exports = idempotencyMiddleware;

const db = require('../database');

function getIdempotencyMiddleware() {
  return function (req, res, next) {
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    
    if (!idempotencyKey) {
      req.idempotencyKey = null;
      return next();
    }

    const requestType = `${req.method}:${req.path}`;

    const existingRecord = db.runGet(`SELECT response_data FROM idempotency_records WHERE idempotency_key = ?`, [idempotencyKey]);

    if (existingRecord) {
      const cachedResponse = JSON.parse(existingRecord.response_data);
      return res.json(cachedResponse);
    }

    req.idempotencyKey = idempotencyKey;
    req.requestType = requestType;

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          db.runExec(`
            INSERT OR IGNORE INTO idempotency_records (idempotency_key, request_type, response_data)
            VALUES (?, ?, ?)
          `, [idempotencyKey, requestType, JSON.stringify(body)]);
        } catch (err) {
          console.error('Failed to save idempotency record:', err);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

function checkAndGetCachedResponse(idempotencyKey, requestType) {
  if (!idempotencyKey) return null;
  
  const record = db.runGet(`
    SELECT response_data FROM idempotency_records 
    WHERE idempotency_key = ? AND request_type = ?
  `, [idempotencyKey, requestType]);

  return record ? JSON.parse(record.response_data) : null;
}

function saveIdempotencyResponse(idempotencyKey, requestType, response) {
  if (!idempotencyKey) return;
  
  try {
    db.runExec(`
      INSERT OR IGNORE INTO idempotency_records (idempotency_key, request_type, response_data)
      VALUES (?, ?, ?)
    `, [idempotencyKey, requestType, JSON.stringify(response)]);
  } catch (err) {
    console.error('Failed to save idempotency record:', err);
  }
}

module.exports = {
  getIdempotencyMiddleware,
  checkAndGetCachedResponse,
  saveIdempotencyResponse,
};

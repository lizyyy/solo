const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { run, get } = require('../models/database');
const { ERROR_CODES } = require('../utils/states');

function checkIdempotency(key, endpoint, requestData) {
  const existing = get(
    `SELECT * FROM idempotency_keys WHERE key = ? AND endpoint = ?`,
    [key, endpoint]
  );

  if (existing) {
    const existingRequest = JSON.parse(existing.request_data);
    if (JSON.stringify(existingRequest) !== JSON.stringify(requestData)) {
      const error = new Error('Idempotency key conflict: different request data');
      error.code = ERROR_CODES.IDEMPOTENCY_CONFLICT;
      error.statusCode = 409;
      throw error;
    }
    return existing.response_data ? JSON.parse(existing.response_data) : null;
  }

  return null;
}

function storeIdempotency(key, endpoint, requestData, responseData) {
  const id = uuidv4();
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    `INSERT INTO idempotency_keys (id, key, endpoint, request_data, response_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      key,
      endpoint,
      JSON.stringify(requestData),
      responseData ? JSON.stringify(responseData) : null,
      createdAt
    ]
  );
}

function idempotencyMiddleware(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key) {
    return next();
  }

  try {
    const cached = checkIdempotency(key, req.path, req.body);
    if (cached) {
      return res.status(200).json({
        ...cached,
        fromCache: true
      });
    }

    res._originalJson = res.json.bind(res);
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        storeIdempotency(key, req.path, req.body, data);
      }
      return res._originalJson(data);
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkIdempotency,
  storeIdempotency,
  idempotencyMiddleware
};

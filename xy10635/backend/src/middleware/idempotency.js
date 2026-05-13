const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getQuery, runQuery } = require('../utils/db');

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }

  const requestHash = crypto.createHash('sha256')
    .update(JSON.stringify({ method: req.method, path: req.path, body: req.body }))
    .digest('hex');

  try {
    const existing = await getQuery(
      'SELECT * FROM idempotency_keys WHERE key = ?',
      [idempotencyKey]
    );

    if (existing) {
      if (existing.request_hash === requestHash && existing.response_data) {
        return res.status(200).json(JSON.parse(existing.response_data));
      }
      return res.status(409).json({
        error: '冲突',
        message: '幂等键已被用于不同的请求'
      });
    }

    const originalJson = res.json;
    res.json = function(data) {
      runQuery(
        'INSERT INTO idempotency_keys (id, key, request_hash, response_data, created_at) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), idempotencyKey, requestHash, JSON.stringify(data), new Date().toISOString()]
      ).catch(err => console.error('保存幂等记录失败:', err));
      return originalJson.call(this, data);
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = idempotencyMiddleware;

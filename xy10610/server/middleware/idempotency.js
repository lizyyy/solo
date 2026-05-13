const crypto = require('crypto');
const { getQuery, runQuery } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function generateRequestHash(req) {
  const data = {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query
  };
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }

  const requestHash = generateRequestHash(req);

  try {
    const existing = await getQuery(
      'SELECT * FROM idempotency_keys WHERE idempotency_key = ?',
      [idempotencyKey]
    );

    if (existing) {
      if (existing.request_hash === requestHash) {
        const responseData = JSON.parse(existing.response_data || '{}');
        return res.status(200).json({
          ...responseData,
          idempotent: true,
          cached: true
        });
      } else {
        return res.status(409).json({
          error: '幂等键已被使用，但请求内容不匹配',
          code: 'IDEMPOTENCY_KEY_MISMATCH'
        });
      }
    }

    const originalJson = res.json.bind(res);
    res.json = function(data) {
      runQuery(
        'INSERT INTO idempotency_keys (id, idempotency_key, request_hash, response_data) VALUES (?, ?, ?, ?)',
        [uuidv4(), idempotencyKey, requestHash, JSON.stringify(data)]
      ).catch(err => console.error('保存幂等记录失败:', err));
      originalJson(data);
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = idempotencyMiddleware;

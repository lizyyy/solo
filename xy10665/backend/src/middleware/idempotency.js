const crypto = require('crypto');
const db = require('../database');

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

function generateRequestHash(req) {
  const data = JSON.stringify({
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function idempotencyMiddleware(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const requestHash = generateRequestHash(req);

  try {
    const existing = await db.get(
      'SELECT * FROM idempotency_keys WHERE request_hash = ? AND expires_at > ?',
      [requestHash, Date.now()]
    );

    if (existing) {
      const responseData = JSON.parse(existing.response_data);
      return res.status(responseData.status).json(responseData.body);
    }

    res.sendResponse = res.json;
    res.json = async function(data) {
      const responseData = JSON.stringify({
        status: res.statusCode,
        body: data
      });

      const id = crypto.randomUUID();
      const expiresAt = Date.now() + IDEMPOTENCY_TTL;

      await db.run(
        'INSERT INTO idempotency_keys (id, request_hash, response_data, expires_at) VALUES (?, ?, ?, ?)',
        [id, requestHash, responseData, expiresAt]
      );

      res.sendResponse(data);
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = idempotencyMiddleware;

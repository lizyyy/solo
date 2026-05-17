const crypto = require('crypto');

const requestCache = new Map();
const CACHE_TTL = 5000;

function generateRequestHash(req) {
  const body = JSON.stringify(req.body);
  const path = req.path;
  const method = req.method;
  return crypto.createHash('md5').update(`${method}:${path}:${body}`).digest('hex');
}

module.exports = (req, res, next) => {
  if (req.method !== 'POST') {
    return next();
  }

  const requestHash = generateRequestHash(req);
  const now = Date.now();

  if (requestCache.has(requestHash)) {
    const cached = requestCache.get(requestHash);
    if (now - cached.timestamp < CACHE_TTL) {
      return res.status(409).json({
        code: 'DUPLICATE_REQUEST',
        message: '检测到重复请求，请稍后再试',
        requestId: cached.requestId,
        retryAfter: Math.ceil((CACHE_TTL - (now - cached.timestamp)) / 1000)
      });
    }
    requestCache.delete(requestHash);
  }

  const requestId = req.headers['x-request-id'] || require('uuid').v4();
  requestCache.set(requestHash, { timestamp: now, requestId });
  res.setHeader('X-Request-Id', requestId);

  setTimeout(() => {
    if (requestCache.has(requestHash)) {
      requestCache.delete(requestHash);
    }
  }, CACHE_TTL);

  next();
};
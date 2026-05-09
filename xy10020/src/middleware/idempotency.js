const IdempotencyRecord = require('../models/IdempotencyRecord');

const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';
const IDEMPOTENCY_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const DEFAULT_TTL = 3600 * 1000;

const idempotencyMiddleware = (req, res, next) => {
  if (!IDEMPOTENCY_METHODS.includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers[IDEMPOTENCY_HEADER.toLowerCase()];

  if (!idempotencyKey) {
    return next();
  }

  const existingRecord = IdempotencyRecord.findByKey(idempotencyKey);

  if (existingRecord) {
    return res.status(existingRecord.statusCode || 200).json(existingRecord.responseBody);
  }

  const originalSend = res.json.bind(res);

  res.json = (body) => {
    IdempotencyRecord.create({
      idempotencyKey,
      requestPath: req.path,
      requestMethod: req.method,
      requestBody: req.body,
      responseBody: body,
      statusCode: res.statusCode,
      userId: req.user?.id,
      ttl: DEFAULT_TTL
    });

    originalSend(body);
  };

  next();
};

module.exports = idempotencyMiddleware;

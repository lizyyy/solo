const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

const checkIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }

  const existing = await db.get(
    'SELECT * FROM idempotency_keys WHERE id = ?',
    [idempotencyKey]
  );

  if (existing) {
    return res.status(409).json({
      error: 'Duplicate request',
      message: '该请求已处理过，请勿重复操作',
      resource_id: existing.resource_id
    });
  }

  await db.run(
    'INSERT INTO idempotency_keys (id, operation_type) VALUES (?, ?)',
    [idempotencyKey, `${req.method} ${req.path}`]
  );

  req.idempotencyKey = idempotencyKey;
  next();
};

const markIdempotencyComplete = async (idempotencyKey, resourceId) => {
  if (!idempotencyKey) return;
  
  await db.run(
    'UPDATE idempotency_keys SET resource_id = ? WHERE id = ?',
    [resourceId, idempotencyKey]
  );
};

module.exports = { checkIdempotency, markIdempotencyComplete };

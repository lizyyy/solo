const { generateId, nowIso, hashRequest } = require('./utils');

function jsonErrorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_JSON',
      message: '请求体JSON格式错误'
    });
  }
  next(err);
}

function checkIdempotency(db, resourceType) {
  return (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      return next();
    }

    try {
      const existing = db.prepare(`
        SELECT * FROM idempotency_records WHERE key = ?
      `).get(idempotencyKey);

      if (existing) {
        if (existing.resource_type !== resourceType) {
          return res.status(409).json({
            success: false,
            error: 'IDEMPOTENCY_KEY_CONFLICT',
            message: `幂等键已用于不同资源类型 (${existing.resource_type})`,
            existing_type: existing.resource_type,
            requested_type: resourceType
          });
        }

        let resource = null;
        switch (existing.resource_type) {
          case 'order':
            resource = db.prepare('SELECT * FROM orders WHERE id = ?').get(existing.resource_id);
            break;
          case 'complaint':
            resource = db.prepare('SELECT * FROM complaints WHERE id = ?').get(existing.resource_id);
            break;
          case 'decibel':
            resource = db.prepare('SELECT * FROM decibel_records WHERE id = ?').get(existing.resource_id);
            break;
          case 'evidence':
            resource = db.prepare('SELECT * FROM evidence_segments WHERE id = ?').get(existing.resource_id);
            break;
        }

        if (resource) {
          return res.status(200).json({
            success: true,
            idempotent: true,
            message: '请求已处理（幂等性命中）',
            data: resource
          });
        }
      }

      req.idempotencyKey = idempotencyKey;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function recordIdempotency(db, idempotencyKey, resourceType, resourceId, requestBody = {}) {
  if (!idempotencyKey) return;

  try {
    db.prepare(`
      INSERT INTO idempotency_records (key, resource_type, resource_id, request_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      idempotencyKey,
      resourceType,
      resourceId,
      hashRequest(requestBody),
      nowIso()
    );
  } catch (e) {
    if (!e.message.includes('UNIQUE constraint')) {
      console.warn('幂等记录写入失败:', e.message);
    }
  }
}

function requireFields(fields) {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: `缺少必填字段: ${missing.join(', ')}`,
        missing_fields: missing
      });
    }
    next();
  };
}

module.exports = {
  jsonErrorHandler,
  checkIdempotency,
  recordIdempotency,
  requireFields
};

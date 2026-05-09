const { queryOne, insert } = require('../db');

function getIdempotencyRecord(idempotencyKey) {
  return queryOne('idempotency_keys', r => r.idempotency_key === idempotencyKey);
}

function recordIdempotency(idempotencyKey, resourceType, resourceId, responseJson) {
  const record = {
    idempotency_key: idempotencyKey,
    resource_type: resourceType,
    resource_id: resourceId,
    response_json: JSON.stringify(responseJson),
    created_at: new Date().toISOString()
  };
  return insert('idempotency_keys', record);
}

function idempotencyMiddleware(resourceType) {
  return (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    
    if (!idempotencyKey) {
      return res.status(400).json({
        code: 1002,
        message: '缺少幂等键 X-Idempotency-Key',
        data: null
      });
    }

    const existing = getIdempotencyRecord(idempotencyKey);
    if (existing) {
      return res.status(200).json({
        ...JSON.parse(existing.response_json),
        from_cache: true
      });
    }

    res.saveIdempotentResponse = (resourceId, responseData) => {
      recordIdempotency(idempotencyKey, resourceType, resourceId, responseData);
    };

    next();
  };
}

module.exports = {
  getIdempotencyRecord,
  recordIdempotency,
  idempotencyMiddleware
};

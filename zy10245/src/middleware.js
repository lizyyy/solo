const { getDb } = require('./database');
const { v4: uuidv4 } = require('uuid');

function generateRequestId(req, res, next) {
  req.requestId = uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

function idempotencyCheck(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (!idempotencyKey) {
    return next();
  }

  const db = getDb();
  const existingOp = db.prepare(`
    SELECT * FROM operation_logs 
    WHERE request_id = ? AND status = 'success'
  `).get(idempotencyKey);

  if (existingOp) {
    return res.status(200).json({
      success: true,
      message: '重复请求已处理',
      idempotent: true,
      originalRequestId: existingOp.request_id
    });
  }

  req.requestId = idempotencyKey;
  next();
}

function logOperation(operationType, entityType) {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      const status = res.statusCode < 400 ? 'success' : 
                     res.statusCode === 409 || res.statusCode === 403 ? 'blocked' : 'failed';
      
      const db = getDb();
      db.prepare(`
        INSERT INTO operation_logs 
        (id, operation_type, entity_type, entity_id, request_id, performed_by, details, status, block_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        operationType,
        entityType,
        req.params.id || null,
        req.requestId,
        req.headers['x-user-id'] || 'system',
        JSON.stringify({ body: req.body, query: req.query }),
        status,
        res.locals.blockReason || null
      );

      originalSend.call(this, data);
    };
    next();
  };
}

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    requestId: req.requestId
  });
}

module.exports = {
  generateRequestId,
  idempotencyCheck,
  logOperation,
  errorHandler
};

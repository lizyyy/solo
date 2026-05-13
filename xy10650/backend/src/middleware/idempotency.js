const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const idempotencyCheck = (operationType) => {
  return (req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;

    db.get(
      'SELECT * FROM operation_logs WHERE request_id = ? AND result != ?',
      [requestId, '重复提交'],
      (err, row) => {
        if (err) {
          return next(err);
        }
        if (row) {
          return res.status(409).json({
            success: false,
            message: '重复请求',
            requestId,
            previousResult: row.result,
            previousReason: row.reason
          });
        }
        next();
      }
    );
  };
};

module.exports = idempotencyCheck;
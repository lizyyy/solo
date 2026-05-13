const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const idempotentMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const businessType = req.path.split('/')[1];
  db.get('SELECT * FROM idempotent_records WHERE request_id = ?', [requestId], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: '数据库错误' });
    }
    if (row) {
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: JSON.parse(row.result),
        message: '重复请求，返回上次结果'
      });
    }
    req.requestId = requestId;
    req.businessType = businessType;
    res.saveIdempotentResult = (businessId, result) => {
      db.run(
        'INSERT INTO idempotent_records (id, request_id, business_type, business_id, result) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), requestId, businessType, businessId, JSON.stringify(result)],
        (err) => {
          if (err) console.error('保存幂等记录失败:', err);
        }
      );
    };
    next();
  });
};
module.exports = idempotentMiddleware;

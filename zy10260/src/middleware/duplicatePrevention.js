const { db } = require('../database');

const checkDuplicateRequest = (tableName) => {
  return (req, res, next) => {
    const requestId = req.body.request_id || req.headers['x-request-id'];
    
    if (!requestId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少 request_id，用于防止重复提交' 
      });
    }

    db.get(`SELECT request_id FROM ${tableName} WHERE request_id = ?`, [requestId], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      
      if (row) {
        return res.status(409).json({ 
          success: false, 
          message: '重复请求，该操作已执行',
          request_id: requestId
        });
      }
      
      req.requestId = requestId;
      next();
    });
  };
};

module.exports = { checkDuplicateRequest };

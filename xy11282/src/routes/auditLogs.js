const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.targetId) filters.targetId = parseInt(req.query.targetId);
    
    const logs = await AuditLog.findAll(filters);
    res.json({
      success: true,
      message: '获取审核日志成功',
      data: logs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取审核日志失败',
      error: error.message
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { AuditLog } = require('../models');
const logger = require('../config/logger');

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, module, action, operatorId } = req.query;
    
    const where = {};
    if (module) where.module = module;
    if (action) where.action = action;
    if (operatorId) where.operator_id = operatorId;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    const maskedData = logger.maskSensitiveData(rows);

    res.json({
      success: true,
      data: {
        list: maskedData,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    logger.error('获取审计日志失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await AuditLog.findByPk(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '审计日志不存在' });
    }
    const maskedData = logger.maskSensitiveData(result);
    res.json({ success: true, data: maskedData });
  } catch (error) {
    logger.error('获取审计日志详情失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

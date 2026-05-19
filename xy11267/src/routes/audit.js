const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditLogCount } = require('../services/auditService');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  try {
    const filters = {
      action_type: req.query.action_type,
      record_id: req.query.record_id,
      operator: req.query.operator,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const logs = await getAuditLogs(filters);
    const total = await getAuditLogCount(filters);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset
        }
      }
    });
  } catch (error) {
    logger.error('获取审计日志失败', { error: error.message });
    res.status(500).json({ error: '获取失败' });
  }
});

module.exports = router;

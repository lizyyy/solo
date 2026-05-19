const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../services/auditService');
const { authMiddleware, permissionMiddleware } = require('../middleware/auth');
const { maskSensitiveFields } = require('../utils/dataMask');

router.use(authMiddleware);

router.get('/', permissionMiddleware('audit:read'), async (req, res) => {
  try {
    const result = await getAuditLogs(req.query);
    res.json({
      success: true,
      data: maskSensitiveFields(result)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询审计日志失败',
      error: error.message
    });
  }
});

module.exports = router;

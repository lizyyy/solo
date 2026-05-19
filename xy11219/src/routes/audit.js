const express = require('express');
const router = express.Router();
const { requirePermission, PERMISSIONS } = require('../middleware/auth');
const { getAuditLogs } = require('../utils/audit');

router.get('/', requirePermission(PERMISSIONS.AUDIT_READ), async (req, res) => {
  try {
    const { userId, action, tableName, startDate, endDate, limit = 100 } = req.query;
    
    const logs = await getAuditLogs({
      userId,
      action,
      tableName,
      startDate,
      endDate,
      limit: parseInt(limit)
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

module.exports = router;

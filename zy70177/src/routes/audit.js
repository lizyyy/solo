const express = require('express');
const router = express.Router();
const { auditService, TABLE_NAMES } = require('../services/audit-service');

router.get('/', async (req, res) => {
  try {
    const tableName = req.query.table;
    const logs = await auditService.getAuditLogs(tableName);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tables', async (req, res) => {
  try {
    res.json({ success: true, data: TABLE_NAMES });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:table/:id', async (req, res) => {
  try {
    const history = await auditService.getRecordHistory(req.params.table, req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

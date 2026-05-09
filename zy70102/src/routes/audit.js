const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditByCommandId } = require('../services/auditService');

router.get('/', (req, res) => {
  const filters = {
    eventType: req.query.eventType,
    deviceId: req.query.deviceId,
    commandId: req.query.commandId,
    startTime: req.query.startTime,
    endTime: req.query.endTime,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
  };
  const logs = getAuditLogs(filters);
  res.json({ success: true, data: logs });
});

router.get('/command/:commandId', (req, res) => {
  const logs = getAuditByCommandId(req.params.commandId);
  res.json({ success: true, data: logs });
});

module.exports = router;

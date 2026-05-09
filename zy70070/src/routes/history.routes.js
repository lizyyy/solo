const express = require('express');
const router = express.Router();
const HistoryService = require('../services/history.service');

router.get('/history/:tableName/:recordId', (req, res) => {
  const { tableName, recordId } = req.params;
  const { limit } = req.query;
  
  const history = HistoryService.getHistory(
    tableName,
    parseInt(recordId),
    limit ? parseInt(limit) : 50
  );
  
  res.json({ success: true, data: history });
});

router.get('/operations', (req, res) => {
  const { type, target_type, limit } = req.query;
  
  const logs = HistoryService.getOperationLogs(
    type,
    target_type,
    limit ? parseInt(limit) : 100
  );
  
  res.json({ success: true, data: logs });
});

router.get('/audit/student/:studentId', (req, res) => {
  const trail = HistoryService.getAuditTrailForStudent(parseInt(req.params.studentId));
  res.json({ success: true, data: trail });
});

module.exports = router;
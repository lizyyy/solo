const express = require('express');
const router = express.Router();
const HistoryService = require('../services/historyService');
const { getDatabase } = require('../models/database');

router.get('/logs', (req, res) => {
  const logs = HistoryService.getAuditLogs(
    req.query.entity_type,
    req.query.entity_id,
    parseInt(req.query.limit) || 100
  );
  res.json(logs);
});

router.get('/summary', (req, res) => {
  const db = getDatabase();
  
  const sampleCount = db.filterSamples(() => true).length;
  const taskCount = db.filterTasks(() => true).length;
  const approvalCount = db.filterApprovals(() => true).length;
  const pendingTasks = db.filterTasks(t => t.status === 'pending').length;
  const pendingApprovals = db.filterApprovals(a => a.status === 'pending').length;
  const destroyedCount = db.filterSamples(s => s.status === 'destroyed').length;
  const extendedTasks = db.filterTasks(t => t.is_extended === 1).length;
  
  res.json({
    samples: sampleCount,
    tasks: taskCount,
    approvals: approvalCount,
    pendingTasks,
    pendingApprovals,
    destroyed: destroyedCount,
    extendedTasks
  });
});

module.exports = router;

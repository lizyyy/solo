const express = require('express');
const AuditService = require('../services/AuditService');
const KeyService = require('../services/KeyService');

const router = express.Router();

router.get('/logs', async (req, res) => {
  try {
    const logs = await AuditService.getAllAuditLogs(req.query);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { keyId, orderId, operator } = req.query;
    const history = await AuditService.getExchangeHistory(keyId, orderId, operator);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { format = 'csv', ...filters } = req.query;
    const data = await AuditService.exportAuditReport(format, filters);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit_report.csv');
      res.send(data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.send(data);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/key-timeline/:keyId', async (req, res) => {
  try {
    const timeline = await AuditService.exportKeyTimeline(req.params.keyId);
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/diff/:entityType/:entityId', async (req, res) => {
  try {
    const diffs = await AuditService.getStatusDiff(req.params.entityType, req.params.entityId);
    res.json(diffs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/record/:recordId/cancel', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const record = await KeyService.cancelRecord(req.params.recordId, operator, reason);
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/record/:recordId/modify', async (req, res) => {
  try {
    const { operator, newData, reason } = req.body;
    const result = await KeyService.modifyRecord(req.params.recordId, operator, newData, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const queryService = require('../services/queryService');

router.get('/history', async (req, res) => {
  try {
    const result = await queryService.queryHistory(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mileage-tracking/:vin', async (req, res) => {
  try {
    const result = await queryService.getMileageTracking(req.params.vin);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const result = await queryService.getExceptionLogs(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/operations', async (req, res) => {
  try {
    const result = await queryService.getOperationLogs(req.query.target_type, req.query.target_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const result = await queryService.exportToCSV(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=records_${Date.now()}.csv`);
    res.send('\uFEFF' + result.csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-trail/:type/:id', async (req, res) => {
  try {
    const result = await queryService.getRecordAuditTrail(req.params.id, req.params.type);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
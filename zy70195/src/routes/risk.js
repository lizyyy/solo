const express = require('express');
const router = express.Router();
const riskService = require('../services/risk-service');

router.post('/', async (req, res) => {
  try {
    const risk = await riskService.addRisk(req.body);
    res.status(201).json({ success: true, data: risk });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const risks = await riskService.getAllActiveRisks();
    res.json({ success: true, data: risks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await riskService.getRiskSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const risk = await riskService.getRiskById(req.params.id);
    if (!risk) {
      return res.status(404).json({ success: false, error: '风险记录不存在' });
    }
    res.json({ success: true, data: risk });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/supplier/:supplierId', async (req, res) => {
  try {
    const risks = await riskService.getRisksBySupplier(req.params.supplierId, false);
    res.json({ success: true, data: risks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const risk = await riskService.resolveRisk(req.params.id, req.body.resolution_notes);
    res.json({ success: true, data: risk });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;

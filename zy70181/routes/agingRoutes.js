const express = require('express');
const router = express.Router();
const agingService = require('../services/agingService');

router.get('/buckets', (req, res) => {
  const buckets = agingService.getAgingBuckets();
  res.json({ success: true, data: buckets });
});

router.post('/calculate', (req, res) => {
  try {
    const { agingDate } = req.body;
    const results = agingService.runAgingCalculation(agingDate);
    res.json({ success: true, data: { count: results.length, items: results } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/latest', (req, res) => {
  const { customerId } = req.query;
  const aging = agingService.getLatestAging(customerId ? parseInt(customerId) : null);
  res.json({ success: true, data: aging });
});

router.get('/summary', (req, res) => {
  const summary = agingService.getAgingSummary();
  res.json({ success: true, data: summary });
});

router.get('/invoice/:id', (req, res) => {
  const aging = agingService.calculateInvoiceAging(parseInt(req.params.id));
  if (!aging) {
    return res.status(404).json({ success: false, error: '发票不存在' });
  }
  res.json({ success: true, data: aging });
});

router.get('/levels', (req, res) => {
  res.json({ 
    success: true, 
    data: Object.entries(agingService.COLLECTION_LEVELS).map(([key, value]) => ({
      key,
      ...value
    }))
  });
});

router.get('/workflow-steps', (req, res) => {
  res.json({ success: true, data: agingService.getAllWorkflowSteps() });
});

module.exports = router;

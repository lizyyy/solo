const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.get('/summary', (req, res) => {
  const result = reportService.getSummary(req.query.date);
  res.json(result);
});

router.get('/detailed', (req, res) => {
  const result = reportService.getDetailedReport(req.query.date);
  res.json(result);
});

router.post('/export', async (req, res) => {
  try {
    const result = await reportService.exportDailyReport(req.query.date);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
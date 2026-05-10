const express = require('express');
const reportService = require('../services/reportService');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  try {
    const summary = reportService.getDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/artifact/:artifactId', (req, res) => {
  try {
    const report = reportService.getArtifactFullReport(req.params.artifactId);
    res.json({ success: true, data: report });
  } catch (err) {
    if (err.message === '制品不存在') {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/promotion/:promotionId', (req, res) => {
  try {
    const report = reportService.getPromotionReport(req.params.promotionId);
    res.json({ success: true, data: report });
  } catch (err) {
    if (err.message === '晋级请求不存在') {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');

router.get('/dashboard', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '缺少 startDate 或 endDate 参数'
      });
    }

    const report = ReportService.generateDashboardReport(startDate, endDate);
    res.json(report);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

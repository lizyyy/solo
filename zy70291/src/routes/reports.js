const express = require('express');
const reportService = require('../services/reportService');
const { handleAsync } = require('../utils/errors');

const router = express.Router();

router.get('/daily', handleAsync(async (req, res) => {
  const report = reportService.getDailyReport(req.query.date);
  res.json({ data: report });
}));

router.get('/dashboard', handleAsync(async (req, res) => {
  const data = reportService.getDashboardData();
  res.json({ data: data });
}));

router.get('/crane-performance/:craneId', handleAsync(async (req, res) => {
  const report = reportService.getCranePerformanceReport(
    req.params.craneId,
    req.query.start_date,
    req.query.end_date
  );
  res.json({ data: report });
}));

router.get('/material-priority', handleAsync(async (req, res) => {
  const report = reportService.getMaterialPriorityReport();
  res.json({ data: report });
}));

module.exports = router;

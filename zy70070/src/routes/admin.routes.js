const express = require('express');
const router = express.Router();
const ConsistencyService = require('../services/consistency.service');
const ReportService = require('../services/report.service');

router.get('/consistency/check', (req, res) => {
  const { auto_fix } = req.query;
  const { operator } = req.body;
  
  if (auto_fix === 'true') {
    const result = ConsistencyService.autoFix(operator || 'system');
    res.json({ success: true, data: result });
  } else {
    const result = ConsistencyService.runFullCheck(operator || 'system');
    res.json({ success: true, data: result });
  }
});

router.post('/consistency/fix', (req, res) => {
  try {
    const { issue, operator } = req.body;
    if (!issue) {
      return res.status(400).json({ success: false, message: '缺少问题信息' });
    }
    
    const result = ConsistencyService.fixBedStudentMismatch(issue, operator || 'system');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/reports/occupancy', (req, res) => {
  const report = ReportService.getDormOccupancyReport();
  res.json({ success: true, data: report });
});

router.get('/reports/transfers', (req, res) => {
  const { period } = req.query;
  const report = ReportService.getTransferStatistics(period || 'month');
  res.json({ success: true, data: report });
});

router.get('/reports/fees', (req, res) => {
  const report = ReportService.getFeeReport();
  res.json({ success: true, data: report });
});

router.get('/reports/access', (req, res) => {
  const { period } = req.query;
  const report = ReportService.getAccessSyncReport(period || 'month');
  res.json({ success: true, data: report });
});

router.get('/reports/comprehensive', (req, res) => {
  const report = ReportService.getComprehensiveReport();
  res.json({ success: true, data: report });
});

router.get('/reports/student/:studentId', (req, res) => {
  const report = ReportService.getStudentDormDetails(parseInt(req.params.studentId));
  if (!report) {
    return res.status(404).json({ success: false, message: '学生不存在' });
  }
  res.json({ success: true, data: report });
});

module.exports = router;
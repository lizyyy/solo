const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.post('/generate', (req, res, next) => {
  try {
    const { date } = req.body;
    const result = reportService.generateDailyReport(date);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = reportService.getReportList(start_date, end_date);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/export', (req, res, next) => {
  try {
    const { date } = req.query;
    const result = reportService.exportReportToCSV(date);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send('\uFEFF' + result.csv);
  } catch (err) {
    next(err);
  }
});

router.get('/overnumber', (req, res, next) => {
  try {
    const result = reportService.getOvernumberRecords();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/exceptions', (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const result = reportService.getExceptionLogs(parseInt(limit));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

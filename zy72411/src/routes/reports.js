const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');

router.post('/weekly/generate', (req, res) => {
  try {
    const { weekStart, weekEnd, generatedBy } = req.body;
    const report = ReportService.generateWeeklyReport(
      weekStart,
      weekEnd,
      generatedBy || 'system'
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/weekly/current', (req, res) => {
  try {
    const { generatedBy } = req.body;
    const report = ReportService.generateCurrentWeekReport(generatedBy || 'system');
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weekly/latest', (req, res) => {
  try {
    const report = ReportService.getLatestReport();
    if (!report) {
      return res.status(404).json({ error: '暂无周报' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weekly/store-manager', (req, res) => {
  try {
    const report = ReportService.getReportForStoreManager();
    if (!report) {
      return res.status(404).json({ error: '暂无周报' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weekly/:id', (req, res) => {
  try {
    const report = ReportService.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: '周报不存在' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weekly', (req, res) => {
  try {
    const reports = ReportService.getAllReports();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/historical', (req, res) => {
  try {
    const records = ReportService.getHistoricalRecords();
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', (req, res) => {
  try {
    const stats = ReportService.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

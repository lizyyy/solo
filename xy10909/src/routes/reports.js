const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.post('/daily', async (req, res) => {
  try {
    const report = await reportService.generateDailyReport(
      req.body.start_date,
      req.body.end_date,
      req.body.generated_by
    );
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {
      report_type: req.query.report_type,
      status: req.query.status,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const reports = reportService.getReports(filters);
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const report = reportService.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在'
      });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/details', (req, res) => {
  try {
    const report = reportService.getReportWithDetails(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在'
      });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

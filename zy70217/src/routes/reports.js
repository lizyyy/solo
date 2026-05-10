const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.get('/doses', (req, res) => {
  try {
    const report = reportService.getDoseReport();
    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.get('/batch/:batchNo', (req, res) => {
  try {
    const report = reportService.getBatchReport(req.params.batchNo);
    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.get('/overview', (req, res) => {
  try {
    const overview = reportService.getSystemOverview();
    res.json({
      success: true,
      data: overview
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

module.exports = router;

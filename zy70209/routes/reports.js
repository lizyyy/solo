const express = require('express');
const router = express.Router();
const {
  generateInventoryReport,
  generateBatchDetailReport,
  generateDonationTraceReport,
  generateRecipientHistoryReport
} = require('../services/reportService');

router.get('/inventory', (req, res) => {
  try {
    const report = generateInventoryReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'REPORT_FAILED'
    });
  }
});

router.get('/batch/:batchId', (req, res) => {
  try {
    const report = generateBatchDetailReport(req.params.batchId);
    if (!report) {
      return res.status(404).json({
        error: '批次不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'REPORT_FAILED'
    });
  }
});

router.get('/donation-trace/:donationId', (req, res) => {
  try {
    const report = generateDonationTraceReport(req.params.donationId);
    if (!report) {
      return res.status(404).json({
        error: '捐赠记录不存在',
        code: 'NOT_FOUND'
      });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'REPORT_FAILED'
    });
  }
});

router.get('/recipient-history/:recipientId', (req, res) => {
  try {
    const report = generateRecipientHistoryReport(req.params.recipientId);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: 'REPORT_FAILED'
    });
  }
});

module.exports = router;

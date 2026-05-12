const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.get('/dashboard', (req, res) => {
  try {
    const dashboard = reportService.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/property-timeline/:property_id', (req, res) => {
  try {
    const report = reportService.getPropertyTimelineReport(req.params.property_id);
    if (!report) {
      return res.status(404).json({ success: false, error: '房源不存在' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/deposit-ledger', (req, res) => {
  try {
    const { booking_id } = req.query;
    const report = reportService.getDepositLedgerReport(booking_id);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/customer-changes', (req, res) => {
  try {
    const { booking_id } = req.query;
    const report = reportService.getCustomerChangesReport(booking_id);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/commission-report', (req, res) => {
  try {
    const { channel_id, status } = req.query;
    const report = reportService.getCommissionReport(channel_id, status);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/full', (req, res) => {
  try {
    const report = reportService.getFullReport();
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const report = reportService.exportReport(format);
    
    if (format === 'text') {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(report);
    } else {
      res.json({ success: true, data: report });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const reportService = require('../services/report-service');
const alertService = require('../services/alert-service');

router.get('/collection-status', async (req, res) => {
  try {
    const report = await reportService.getCollectionStatusReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/milestone-collection', async (req, res) => {
  try {
    const projectId = req.query.project_id ? parseInt(req.query.project_id) : null;
    const report = await reportService.getMilestoneCollectionReport(projectId);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/invoice-payment', async (req, res) => {
  try {
    const report = await reportService.generateInvoicePaymentReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const alerts = await alertService.getDashboardAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/collection', async (req, res) => {
  try {
    const projectId = req.query.project_id ? parseInt(req.query.project_id) : null;
    const result = await reportService.exportReportToFile('collection', projectId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/invoice-payment', async (req, res) => {
  try {
    const result = await reportService.exportReportToFile('invoice_payment');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

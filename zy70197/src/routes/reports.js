const express = require('express');
const router = express.Router();
const ReportService = require('../services/ReportService');

router.get('/', (req, res) => {
  try {
    const reports = ReportService.getAllReports();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agreements/:id', (req, res) => {
  try {
    const report = ReportService.getAgreementReport(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/agreements/:id/prediction', (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30;
    const prediction = ReportService.getPrediction(req.params.id, days);
    res.json(prediction);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

module.exports = router;

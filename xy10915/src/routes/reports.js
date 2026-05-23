const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');

router.get('/appointments', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await ReportService.generateAppointmentReport(start_date, end_date);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const csv = await ReportService.exportToCSV(start_date, end_date);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=appointments_${start_date}_${end_date}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const { date } = req.query;
    const result = await ReportService.getStatistics(date);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

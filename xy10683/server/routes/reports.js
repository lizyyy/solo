const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

router.get('/', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      status: req.query.status,
      operator: req.query.operator
    };
    const data = await reportService.generateReport(filters);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      status: req.query.status,
      operator: req.query.operator
    };
    const workbook = await reportService.exportToExcel(filters);
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=queue_report_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/turnover-suggestions', async (req, res) => {
  try {
    const data = await reportService.getTurnoverSuggestions();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

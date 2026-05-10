const express = require('express');
const { Parser } = require('json2csv');
const router = express.Router();
const reportService = require('../services/reportService');

router.get('/aging-detail', (req, res) => {
  const { customerId } = req.query;
  const report = reportService.getAgingReportDetail(
    customerId ? parseInt(customerId) : null
  );
  res.json({ success: true, data: report });
});

router.get('/collection-performance', (req, res) => {
  const { startDate, endDate } = req.query;
  const report = reportService.getCollectionPerformanceReport(startDate, endDate);
  res.json({ success: true, data: report });
});

router.get('/customer-360/:customerId', (req, res) => {
  const view = reportService.getCustomer360View(parseInt(req.params.customerId));
  if (!view) {
    return res.status(404).json({ success: false, error: '客户不存在' });
  }
  res.json({ success: true, data: view });
});

router.get('/export/:reportType', (req, res) => {
  try {
    const { reportType } = req.params;
    const { customerId, format = 'json' } = req.query;
    
    const exportData = reportService.generateExportData(reportType, {
      customerId: customerId ? parseInt(customerId) : null
    });
    
    if (format === 'csv') {
      const parser = new Parser({ fields: exportData.headers });
      const csv = parser.parse(exportData.data);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}-${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({ success: true, data: exportData });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

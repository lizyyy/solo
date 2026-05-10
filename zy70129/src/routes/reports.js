const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const responseHandler = require('../utils/responseHandler');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/daily/:date', (req, res) => {
  try {
    const report = reportService.generateDailyReport(req.params.date, getOperator(req));
    res.json(responseHandler.success(report, '日报表生成成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.get('/daily/:date', (req, res) => {
  try {
    const report = reportService.getReportByDate(req.params.date, 'DAILY');
    if (!report) {
      return res.status(404).json(responseHandler.notFound('报表不存在'));
    }
    res.json(responseHandler.success(report));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.get('/daily/:date/export', (req, res) => {
  try {
    const csv = reportService.exportDailyReportToCSV(req.params.date);
    if (!csv) {
      return res.status(404).json(responseHandler.notFound('报表不存在'));
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=daily-report-${req.params.date}.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.get('/order/:orderId/export', (req, res) => {
  try {
    const csv = reportService.exportOrderToCSV(req.params.orderId);
    if (!csv) {
      return res.status(404).json(responseHandler.notFound('订单不存在'));
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=order-${req.params.orderId}.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.get('/order/:orderId/data', (req, res) => {
  try {
    const data = reportService.getOrderExportData(req.params.orderId);
    if (!data) {
      return res.status(404).json(responseHandler.notFound('订单不存在'));
    }
    res.json(responseHandler.success(data));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

module.exports = router;

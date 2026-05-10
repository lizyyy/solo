const express = require('express');
const router = express.Router();
const reportService = require('../services/ReportService');
const { success, handleError } = require('../utils/response');

router.get('/daily', async (req, res) => {
  try {
    const report = await reportService.getDailyReport(req.query);
    res.json(success(report, '获取日报表成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/window', async (req, res) => {
  try {
    const report = await reportService.getWindowReport(req.query);
    res.json(success(report, '获取窗口报表成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

router.post('/export/:reportType', async (req, res) => {
  try {
    const filePath = await reportService.exportToExcel(req.params.reportType, req.query);
    res.download(filePath, (err) => {
      if (err) {
        console.error('下载失败:', err);
      }
    });
  } catch (error) {
    res.json(handleError(error));
  }
});

router.get('/audit-trail/:receiptNumber', async (req, res) => {
  try {
    const trail = await reportService.getAuditTrail(req.params.receiptNumber);
    res.json(success(trail, '获取审计追踪成功'));
  } catch (error) {
    res.json(handleError(error));
  }
});

module.exports = router;

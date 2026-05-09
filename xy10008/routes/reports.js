const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');
const logger = require('../utils/logger');
const taskQueue = require('../utils/taskQueue');

router.get('/full', async (req, res) => {
  try {
    const report = ReportService.generateFullReport();
    res.json({ success: true, data: report.summary });
  } catch (error) {
    logger.error('GET /api/reports/full error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/full/download', async (req, res) => {
  try {
    const report = ReportService.generateFullReport();
    const fullCsv = report.billsCsv + '\n\n--- 余额 ---\n\n' + report.balancesCsv + '\n\n--- 结算建议 ---\n\n' + report.settlementsCsv;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=full_report_${Date.now()}.csv`);
    res.send('\ufeff' + fullCsv);
  } catch (error) {
    logger.error('GET /api/reports/full/download error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = ReportService.generateDateRangeReport(startDate, endDate);
    res.json({ success: true, data: report.summary });
  } catch (error) {
    logger.error('GET /api/reports/date-range error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/date-range/download', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = ReportService.generateDateRangeReport(startDate, endDate);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=date_range_report_${Date.now()}.csv`);
    res.send('\ufeff' + report.billsCsv);
  } catch (error) {
    logger.error('GET /api/reports/date-range/download error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const report = ReportService.generateUserReport(req.params.userId);
    res.json({ 
      success: true, 
      data: {
        user: report.user,
        summary: report.summary,
        records: report.records
      } 
    });
  } catch (error) {
    logger.error('GET /api/reports/user/:userId error', { error: error.message, userId: req.params.userId });
    if (error.message === 'User not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/user/:userId/download', async (req, res) => {
  try {
    const report = ReportService.generateUserReport(req.params.userId);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=user_report_${req.params.userId}_${Date.now()}.csv`);
    res.send('\ufeff' + report.csv);
  } catch (error) {
    logger.error('GET /api/reports/user/:userId/download error', { error: error.message, userId: req.params.userId });
    if (error.message === 'User not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/async/full', async (req, res) => {
  try {
    const taskId = await ReportService.generateAsyncReport('full');
    res.json({ success: true, data: { taskId, message: 'Report generation queued' }});
  } catch (error) {
    logger.error('POST /api/reports/async/full error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/async/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const taskId = await ReportService.generateAsyncReport('dateRange', { startDate, endDate });
    res.json({ success: true, data: { taskId, message: 'Report generation queued' }});
  } catch (error) {
    logger.error('POST /api/reports/async/date-range error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/async/user/:userId', async (req, res) => {
  try {
    const taskId = await ReportService.generateAsyncReport('user', { userId: req.params.userId });
    res.json({ success: true, data: { taskId, message: 'Report generation queued' }});
  } catch (error) {
    logger.error('POST /api/reports/async/user/:userId error', { error: error.message, userId: req.params.userId });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/async/status/:taskId', async (req, res) => {
  try {
    const status = taskQueue.getTaskStatus(req.params.taskId);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('GET /api/reports/async/status/:taskId error', { error: error.message, taskId: req.params.taskId });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

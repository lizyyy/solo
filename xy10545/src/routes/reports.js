const express = require('express');
const router = express.Router();
const ReportService = require('../services/ReportService');
const { handleError, ApiError } = require('../utils/errorHandler');

router.get('/timeline/:conversationId', async (req, res, next) => {
  try {
    const timeline = ReportService.getConversationTimeline(req.params.conversationId);
    if (!timeline) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    res.json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
});

router.get('/queue', async (req, res, next) => {
  try {
    const report = ReportService.getQueueReport();
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.get('/agents', async (req, res, next) => {
  try {
    const report = ReportService.getAgentPerformanceReport();
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.get('/overview', async (req, res, next) => {
  try {
    const stats = ReportService.getOverallStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const report = ReportService.exportReport(format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
      res.send(report);
    } else {
      res.json({ success: true, data: report });
    }
  } catch (err) {
    next(err);
  }
});

router.use(handleError);

module.exports = router;

const express = require('express');
const router = express.Router();
const reportService = require('../services/report-service');
const { AuditLog } = require('../utils');
const exportService = require('../services/export-service');
const { formatDate } = require('../utils');

router.get('/summary', (req, res) => {
  try {
    const startTime = req.query.start ? parseInt(req.query.start) : null;
    const endTime = req.query.end ? parseInt(req.query.end) : null;
    
    const report = reportService.getFullReport(startTime, endTime);
    res.json({ success: true, data: report });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/liability', (req, res) => {
  try {
    const startTime = req.query.start ? parseInt(req.query.start) : null;
    const endTime = req.query.end ? parseInt(req.query.end) : null;
    
    const stats = reportService.getLiabilityStats(startTime, endTime);
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/cost', (req, res) => {
  try {
    const startTime = req.query.start ? parseInt(req.query.start) : null;
    const endTime = req.query.end ? parseInt(req.query.end) : null;
    const responsibility = req.query.responsibility;
    
    const stats = reportService.getCostStats(startTime, endTime, responsibility);
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/order-status', (req, res) => {
  try {
    const stats = reportService.getOrderStatusStats();
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/rejudge', (req, res) => {
  try {
    const startTime = req.query.start ? parseInt(req.query.start) : null;
    const endTime = req.query.end ? parseInt(req.query.end) : null;
    
    const stats = reportService.getRejudgeStats(startTime, endTime);
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/logs', (req, res) => {
  try {
    const module = req.query.module;
    const limit = parseInt(req.query.limit) || 100;
    const logs = AuditLog.getAllLogs(module, limit);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/logs/export', (req, res) => {
  try {
    const module = req.query.module;
    const limit = parseInt(req.query.limit) || 10000;
    const logs = AuditLog.getAllLogs(module, limit);
    const csv = exportService.exportOperationLogsToCSV(logs);
    const filename = `操作日志_${formatDate(Date.now()).replace(/[/:]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;

const express = require('express');
const reportService = require('../services/reportService');
const { authenticate, requireRole } = require('../middleware/auth');
const { success } = require('../utils/response');

const router = express.Router();

router.get('/push', authenticate, requireRole('admin', 'operator', 'viewer'), async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      pushType: req.query.pushType,
    };
    
    const report = await reportService.generatePushReport(filters);
    res.json(success(report));
  } catch (err) {
    next(err);
  }
});

router.get('/audit', authenticate, requireRole('admin', 'viewer'), async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      action: req.query.action,
      userId: req.query.userId,
    };
    
    const report = await reportService.generateAuditReport(filters);
    res.json(success(report));
  } catch (err) {
    next(err);
  }
});

router.get('/push/export', authenticate, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      pushType: req.query.pushType,
    };
    
    const { buffer, filename } = await reportService.exportPushReportToExcel(filters, req.user, req);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/audit/export', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      action: req.query.action,
      userId: req.query.userId,
    };
    
    const { buffer, filename } = await reportService.exportAuditReportToExcel(filters, req.user, req);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

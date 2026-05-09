const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const { wrapResponse } = require('../middleware/idempotent');
const { getAuditLogs } = require('../middleware/audit');
const { auditMiddleware, AUDIT_ACTIONS, MODULES } = require('../middleware/audit');
const moment = require('moment');

function getOperator(req) {
  const op = req.headers['x-operator'];
  if (op) {
    try {
      return decodeURIComponent(op);
    } catch (e) {
      return op;
    }
  }
  return 'system';
}

router.get('/statistics', wrapResponse(async (req, res) => {
  const startTime = req.query.startTime ? parseInt(req.query.startTime) : null;
  const endTime = req.query.endTime ? parseInt(req.query.endTime) : null;
  return reportService.getStatisticsReport(startTime, endTime);
}));

router.get('/export', 
  auditMiddleware(AUDIT_ACTIONS.EXPORT_REPORT, MODULES.REPORT),
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.assignee) filter.assignee = req.query.assignee;
      if (req.query.created_by) filter.created_by = req.query.created_by;
      if (req.query.problem_type) filter.problem_type = req.query.problem_type;
      if (req.query.startTime) filter.startTime = parseInt(req.query.startTime);
      if (req.query.endTime) filter.endTime = parseInt(req.query.endTime);
      
      const operator = getOperator(req);
      const csv = await reportService.exportTasksToCSV(filter, operator);
      
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `tasks_export_${timestamp}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/audit', wrapResponse(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.module) filter.module = req.query.module;
  if (req.query.targetId) filter.targetId = req.query.targetId;
  if (req.query.operator) filter.operator = req.query.operator;
  if (req.query.startTime) filter.startTime = parseInt(req.query.startTime);
  if (req.query.endTime) filter.endTime = parseInt(req.query.endTime);
  
  return getAuditLogs(filter, page, pageSize);
}));

module.exports = router;

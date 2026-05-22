const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');
const TaskService = require('../services/taskService');
const { requirePermission, requireRole, authMiddleware } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

router.use(authMiddleware);

router.get('/project-manager', requireRole([ROLES.PROJECT_MANAGER, ROLES.ADMIN]), (req, res) => {
  try {
    const data = ReportService.getProjectManagerView(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/technician/:id', requireRole([ROLES.TECHNICIAN, ROLES.ADMIN]), (req, res) => {
  try {
    const data = ReportService.getTechnicianView(req.params.id, req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/auditor', requireRole([ROLES.AUDITOR, ROLES.ADMIN]), (req, res) => {
  try {
    const data = ReportService.getAuditorView(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/failed-items', requirePermission('report:view'), (req, res) => {
  try {
    const data = ReportService.exportFailedItems(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export-orders', requirePermission('report:export'), (req, res) => {
  try {
    const { desensitized = false } = req.query;
    const data = ReportService.exportOrders(req.query, {
      desensitized: desensitized === 'true'
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks/stats', requirePermission('report:view'), (req, res) => {
  try {
    const stats = TaskService.getTaskQueueStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks/failed-summary', requirePermission('report:view'), (req, res) => {
  try {
    const summary = TaskService.getFailedTasksSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

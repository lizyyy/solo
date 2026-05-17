const express = require('express');
const router = express.Router();
const { DeactivationService } = require('./services/deactivationService');
const ReportService = require('./services/reportService');

const deactivationService = new DeactivationService();
const reportService = new ReportService();

router.get('/systems', (req, res) => {
  try {
    const systems = deactivationService.getAllSystems();
    res.json({ success: true, data: systems });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tasks', (req, res) => {
  try {
    const { employeeId, employeeName, requestedBy, systems, accountMap } = req.body;

    if (!employeeId || !requestedBy || !systems) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: employeeId, requestedBy, systems'
      });
    }

    const task = deactivationService.createTask(
      employeeId,
      employeeName,
      requestedBy,
      systems,
      accountMap || {}
    );

    res.status(201).json({
      success: true,
      message: '任务创建成功',
      data: task
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks', (req, res) => {
  try {
    const { employeeId, status, requestedBy } = req.query;
    const tasks = deactivationService.listTasks({ employeeId, status, requestedBy });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks/:taskId', (req, res) => {
  try {
    const task = deactivationService.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/start', (req, res) => {
  try {
    const { actor } = req.body;
    if (!actor) {
      return res.status(400).json({ success: false, error: '缺少操作人(actor)' });
    }

    const task = deactivationService.startTask(req.params.taskId, actor);
    res.json({
      success: true,
      message: '任务已启动',
      data: task
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/items/:itemId/process', (req, res) => {
  try {
    const { actor } = req.body;
    if (!actor) {
      return res.status(400).json({ success: false, error: '缺少操作人(actor)' });
    }

    const task = deactivationService.processItem(
      req.params.taskId,
      req.params.itemId,
      actor
    );

    res.json({
      success: true,
      message: '处理完成',
      data: task
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/items/:itemId/retry', (req, res) => {
  try {
    const { actor } = req.body;
    if (!actor) {
      return res.status(400).json({ success: false, error: '缺少操作人(actor)' });
    }

    const task = deactivationService.retryItem(
      req.params.taskId,
      req.params.itemId,
      actor
    );

    res.json({
      success: true,
      message: '重试完成',
      data: task
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/items/:itemId/manual', (req, res) => {
  try {
    const { actor, correctionNote, markAsSuccess } = req.body;
    if (!actor || !correctionNote) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: actor, correctionNote'
      });
    }

    const task = deactivationService.manualCorrect(
      req.params.taskId,
      req.params.itemId,
      actor,
      correctionNote,
      markAsSuccess !== false
    );

    res.json({
      success: true,
      message: '人工修正已记录',
      data: task
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tasks/:taskId/audit', (req, res) => {
  try {
    const logs = deactivationService.getAuditLogs(req.params.taskId);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks/:taskId/report', (req, res) => {
  try {
    const { format } = req.query;
    const report = reportService.generateReport(
      req.params.taskId,
      format === 'csv' ? 'csv' : 'json'
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="deactivation-report-${req.params.taskId}.csv"`
      );
      res.send('\uFEFF' + report);
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(report);
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tasks/:taskId/report/metadata', (req, res) => {
  try {
    const metadata = reportService.getReportMetadata(req.params.taskId);
    res.json({ success: true, data: metadata });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const batchService = require('../services/batchService');
const exportService = require('../services/exportService');

router.post('/', (req, res) => {
  try {
    const { data, operator, role } = req.body;
    const result = taskService.createTask(data, operator, role);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { tasks, operator, role } = req.body;
    const result = batchService.batchCreate(tasks, operator, role);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/accept', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, role } = req.body;
    const result = taskService.acceptTask(id, operator, role);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batch/accept', (req, res) => {
  try {
    const { task_ids, operator, role } = req.body;
    const result = batchService.batchAccept(task_ids, operator, role);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, role } = req.body;
    const result = taskService.startTask(id, operator, role);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, role, actual_duration, overtime_reason } = req.body;
    const result = taskService.completeTask(id, operator, role, actual_duration, overtime_reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, role, reason } = req.body;
    const result = taskService.cancelTask(id, operator, role, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batch/cancel', (req, res) => {
  try {
    const { task_ids, operator, role, reason } = req.body;
    const result = batchService.batchCancel(task_ids, operator, role, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/jump-queue', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, role, target_position } = req.body;
    const result = taskService.jumpQueue(id, operator, role, target_position);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batch/retry', (req, res) => {
  try {
    const { failed_items, operator, role } = req.body;
    const result = batchService.batchRetry(failed_items, operator, role);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = taskService.getTaskDetail(id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const tasks = taskService.listTasks(req.query);
    res.json({ success: true, data: tasks, count: tasks.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/tasks', async (req, res) => {
  try {
    const result = await exportService.exportTasksToCSV(req.query);
    res.download(result.filepath, result.filename);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/audit', (req, res) => {
  try {
    const logs = exportService.queryAuditLogs(req.query);
    res.json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/audit', async (req, res) => {
  try {
    const result = await exportService.exportAuditToCSV(req.query);
    res.download(result.filepath, result.filename);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/statistics/summary', (req, res) => {
  try {
    const stats = exportService.getStatistics(req.query);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

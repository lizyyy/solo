const express = require('express');
const router = express.Router();
const TaskService = require('../services/taskService');
const { requirePermission, authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', requirePermission('task:view'), (req, res) => {
  try {
    const { status } = req.query;
    let tasks;
    if (status) {
      tasks = TaskService.getTasksByStatus(status);
    } else {
      tasks = TaskService.getPendingTasks(100);
    }
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('task:create'), (req, res) => {
  try {
    const task = TaskService.createTask(
      req.body.task_type,
      req.body.related_id,
      req.body.related_type
    );
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requirePermission('task:view'), (req, res) => {
  try {
    const task = TaskService.getTaskById(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/retry', requirePermission('task:edit'), (req, res) => {
  try {
    const task = TaskService.retryTask(req.params.id, req.user);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/mark-handled', requirePermission('task:edit'), (req, res) => {
  try {
    TaskService.markAsManualHandled(
      req.params.id,
      req.user,
      req.body.remark || '已处理完成'
    );
    res.json({ success: true, message: '已标记为人工处理完成' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/process', requirePermission('task:edit'), async (req, res) => {
  try {
    const results = TaskService.processTaskQueue(async (task) => {
      console.log(`Processing task: ${task.id}, type: ${task.task_type}`);
      await new Promise(r => setTimeout(r, 100));
    }, { limit: req.body.limit || 10 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

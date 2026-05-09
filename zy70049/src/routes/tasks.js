const express = require('express');
const router = express.Router();
const TaskService = require('../services/taskService');

router.post('/generate', (req, res) => {
  try {
    const result = TaskService.generateExpiryTasks(req.body.targetDate);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const tasks = TaskService.getTasks(req.query);
  res.json(tasks);
});

router.get('/:id', (req, res) => {
  const task = TaskService.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(task);
});

router.post('/:id/extend', (req, res) => {
  try {
    const { extension_days, reason, operator } = req.body;
    const task = TaskService.extendTask(req.params.id, extension_days, reason, operator);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/jobs/runs', (req, res) => {
  const runs = TaskService.getJobRuns(req.query.job_name || 'generate_expiry_tasks');
  res.json(runs);
});

module.exports = router;
